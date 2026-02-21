import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// PDF.js worker for text extraction (Vite)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGES_FOR_AI = 5; // Groq limit

// Use VITE_GROQ_API_KEY in .env (Vite exposes only VITE_* to client). Fallback GROQ_API_KEY for compatibility.
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY;
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: reader.result, mime: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text.slice(0, 15000); // cap to avoid token limit
}

export default function PatientStatusUpdateModal({ bed, onClose, onUpdate }) {
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Form state
    const [healthCondition, setHealthCondition] = useState('');
    const [vitalSigns, setVitalSigns] = useState({
        bloodPressure: '',
        heartRate: '',
        temperature: '',
        oxygenLevel: '',
        respiratoryRate: ''
    });
    const [symptoms, setSymptoms] = useState('');
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [wardBoyName, setWardBoyName] = useState('');
    
    // File uploads
    const [files, setFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    
    // AI Prediction result
    const [aiPrediction, setAiPrediction] = useState(null);
    
    // Previous visit history
    const [visitHistory, setVisitHistory] = useState([]);

    const patientName = bed.activeQueue?.patient_name || 'Unknown Patient';
    const disease = bed.activeQueue?.disease || 'N/A';
    const bedQueueId = bed.activeQueue?.id;

    useEffect(() => {
        const phone = bed.activeQueue?.phone;
        const name = bed.activeQueue?.patient_name;
        if (phone) fetchVisitHistoryByPhone(phone);
        else if (name) fetchVisitHistoryByName(name);
    }, [bed.activeQueue]);

    const fetchVisitHistoryByPhone = async (phone) => {
        try {
            const { data, error } = await supabase
                .from('patient_visit_history')
                .select('*')
                .eq('phone', phone)
                .order('visit_date', { ascending: false })
                .limit(10);
            if (error) throw error;
            setVisitHistory(data || []);
        } catch (err) {
            console.error('Error fetching visit history by phone:', err);
        }
    };

    const fetchVisitHistoryByName = async (name) => {
        try {
            const { data, error } = await supabase
                .from('patient_visit_history')
                .select('*')
                .ilike('patient_name', name)
                .order('visit_date', { ascending: false })
                .limit(10);
            if (error) throw error;
            setVisitHistory(data || []);
        } catch (err) {
            console.error('Error fetching visit history by name:', err);
        }
    };

    const handleFileChange = (e, fileType) => {
        const selectedFiles = Array.from(e.target.files);
        const newFiles = selectedFiles.map(file => ({
            file,
            fileType,
            id: Math.random().toString(36).substr(2, 9)
        }));
        setFiles(prev => [...prev, ...newFiles]);
    };

    const removeFile = (fileId) => {
        setFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const uploadFilesToStorage = async (healthUpdateId) => {
        const uploadedRecords = [];
        
        for (const fileItem of files) {
            try {
                setUploadProgress(prev => ({ ...prev, [fileItem.id]: 0 }));
                
                const fileExt = fileItem.file.name.split('.').pop();
                const fileName = `${healthUpdateId}/${Date.now()}_${fileItem.id}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('medical-records')
                    .upload(fileName, fileItem.file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error('Upload error details:', uploadError);
                    throw uploadError;
                }

                // Get public URL (works for both public and private buckets)
                const { data: { publicUrl } } = supabase.storage
                    .from('medical-records')
                    .getPublicUrl(fileName);

                // Save record to database
                const { data: recordData, error: recordError } = await supabase
                    .from('medical_records')
                    .insert({
                        health_update_id: healthUpdateId,
                        bed_queue_id: bedQueueId,
                        file_name: fileItem.file.name,
                        file_type: fileItem.fileType,
                        file_format: fileExt,
                        file_url: publicUrl,
                        file_size: fileItem.file.size,
                        uploaded_by_name: wardBoyName
                    })
                    .select()
                    .single();

                if (recordError) throw recordError;
                
                uploadedRecords.push(recordData);
                setUploadProgress(prev => ({ ...prev, [fileItem.id]: 100 }));
            } catch (err) {
                console.error('Error uploading file:', err);
                throw new Error(`Failed to upload ${fileItem.file.name}: ${err.message}`);
            }
        }
        
        return uploadedRecords;
    };

    const getAIPrediction = async (healthData, previousVisits = [], filesToUse = []) => {
        if (!GROQ_API_KEY) {
            setError('Groq API key not configured. Set VITE_GROQ_API_KEY in .env');
            return null;
        }
        setAiLoading(true);
        setError('');
        try {
            const visitsText = previousVisits.length > 0
                ? previousVisits.map((v, i) => `Visit ${i + 1} (${v.visit_date ? new Date(v.visit_date).toLocaleDateString() : 'N/A'}): Diagnosis: ${v.diagnosis || 'N/A'}; Treatment: ${v.treatment || 'N/A'}; Medications: ${v.medications || 'N/A'}; Doctor: ${v.doctor_name || 'N/A'}`).join('\n')
                : 'No previous visit data available.';

            let pdfText = '';
            const imageB64List = [];
            for (const item of filesToUse) {
                const f = item.file;
                if (f.type === 'application/pdf') {
                    try {
                        pdfText += `\n--- PDF: ${f.name} (${item.fileType}) ---\n` + (await extractPdfText(f));
                    } catch (e) {
                        console.warn('PDF extract failed:', f.name, e);
                        pdfText += `\n--- PDF: ${f.name} (could not extract text) ---\n`;
                    }
                } else if (IMAGE_TYPES.includes(f.type) && imageB64List.length < MAX_IMAGES_FOR_AI) {
                    try {
                        const { data } = await readFileAsBase64(f);
                        imageB64List.push({ url: data, type: item.fileType });
                    } catch (e) {
                        console.warn('Image read failed:', f.name, e);
                    }
                }
            }

            const documentsSection = (pdfText || imageB64List.length > 0)
                ? `\n\nUploaded documents (use this to inform discharge estimate):\n${pdfText ? 'Extracted text from PDFs:' + pdfText : ''}${imageB64List.length > 0 ? `\n[${imageB64List.length} image(s) attached: ${imageB64List.map(i => i.type).join(', ')}]` : ''}`
                : '';

            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10) + ' ' + today.getHours() + ':' + String(today.getMinutes()).padStart(2, '0');

            const prompt = `You are a hospital discharge planning AI. Your task is to estimate when this INPATIENT can be safely discharged based on their condition, vitals, history, and any reports.

RULES FOR ESTIMATED DISCHARGE DATE:
- Today is: ${todayStr}. Use this as reference.
- Inpatients are rarely discharged within 24 hours. Only estimate same-day or next-day discharge if the condition is clearly minor (e.g. observation only, stable vitals, no ongoing treatment).
- For most admissions (infection, surgery, acute illness): estimate 2–7+ days from today depending on severity. For example: uncomplicated pneumonia often 3–5 days; post-surgery depends on procedure; critical/ICU patients typically need several days minimum.
- estimatedDischargeDate MUST be in the future (after today). Use format YYYY-MM-DD 14:00 (use 14:00 as default time for discharge).
- Base the date on: (1) typical recovery for the stated disease, (2) current vitals and condition, (3) previous visits and any lab/imaging findings in the documents. When in doubt, prefer a conservative (later) date rather than too early.

Patient Information:
- Name: ${patientName}
- Disease/Condition: ${disease}
- Current Condition: ${healthData.healthCondition}
- Vital Signs: BP: ${healthData.vitalSigns.bloodPressure}, HR: ${healthData.vitalSigns.heartRate}, Temp: ${healthData.vitalSigns.temperature}°F, O2: ${healthData.vitalSigns.oxygenLevel}%, RR: ${healthData.vitalSigns.respiratoryRate}
- Symptoms: ${healthData.symptoms}
- Additional Info: ${healthData.additionalInfo}

Previous doctor visits and history:
${visitsText}
${documentsSection}

Respond with ONLY this JSON object, no other text:
{
  "estimatedDischargeDate": "YYYY-MM-DD 14:00",
  "carePlan": "brief care recommendations",
  "riskLevel": "low, moderate, or high",
  "warnings": "any concerns or warnings"
}`;

            const userContent = imageB64List.length > 0
                ? [
                    { type: 'text', text: prompt },
                    ...imageB64List.map(({ url }) => ({ type: 'image_url', image_url: { url } }))
                ]
                : prompt;

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        { role: 'system', content: 'You are a medical discharge planning AI. Respond only with valid JSON. estimatedDischargeDate must be a future date in YYYY-MM-DD 14:00 format, typically 2–7 days from today for inpatients, not within a few hours.' },
                        { role: 'user', content: userContent }
                    ],
                    temperature: 0.3,
                    max_tokens: 500,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('AI API error:', errorData);
                throw new Error('AI prediction failed');
            }
            
            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // Try to parse JSON, with fallback
            let aiResponse;
            try {
                aiResponse = JSON.parse(content);
            } catch (parseError) {
                console.warn('AI response not JSON, creating fallback:', content);
                // Create a fallback response
                const fallbackDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
                aiResponse = {
                    estimatedDischargeDate: fallbackDate.toISOString().slice(0, 10) + ' 14:00',
                    carePlan: content.substring(0, 200) || 'Continue monitoring patient condition',
                    riskLevel: 'moderate',
                    warnings: 'AI prediction unavailable, manual assessment required'
                };
            }
            
            // Ensure discharge date is at least ~2 days from now (avoid "20h left" for inpatients)
            const minDischargeMs = Date.now() + 2 * 24 * 60 * 60 * 1000;
            const parsed = aiResponse.estimatedDischargeDate ? new Date(aiResponse.estimatedDischargeDate.replace(' ', 'T')).getTime() : 0;
            if (parsed > 0 && parsed < minDischargeMs) {
                const adjusted = new Date(minDischargeMs);
                aiResponse.estimatedDischargeDate = adjusted.toISOString().slice(0, 10) + ' 14:00';
            }

            setAiPrediction(aiResponse);
            return aiResponse;
        } catch (err) {
            console.error('Error getting AI prediction:', err);
            // Return a default prediction so form can still submit
            const fallbackDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            const fallbackPrediction = {
                estimatedDischargeDate: fallbackDate.toISOString().slice(0, 10) + ' 14:00',
                carePlan: 'Monitor vital signs regularly, continue current treatment',
                riskLevel: 'moderate',
                warnings: 'AI prediction unavailable - manual assessment required'
            };
            setAiPrediction(fallbackPrediction);
            return fallbackPrediction;
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!wardBoyName.trim()) {
            setError('Please enter your name');
            return;
        }
        
        if (!healthCondition.trim()) {
            setError('Please enter health condition');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Get AI prediction first (include previous visits + uploaded files for better estimate)
            const prediction = await getAIPrediction(
                { healthCondition, vitalSigns, symptoms, additionalInfo },
                visitHistory,
                files
            );

            // Insert health update
            const { data: healthUpdate, error: healthError } = await supabase
                .from('patient_health_updates')
                .insert({
                    bed_queue_id: bedQueueId,
                    bed_id: bed.bed_id,
                    patient_name: patientName,
                    health_condition: healthCondition,
                    vital_signs: vitalSigns,
                    symptoms,
                    additional_info: additionalInfo,
                    updated_by_name: wardBoyName,
                    updated_by_role: 'ward_boy',
                    ai_prediction: prediction,
                    estimated_discharge_date: prediction?.estimatedDischargeDate || null
                })
                .select()
                .single();

            if (healthError) throw healthError;

            // Upload files if any (don't fail if upload fails)
            if (files.length > 0) {
                try {
                    await uploadFilesToStorage(healthUpdate.id);
                } catch (uploadError) {
                    console.error('File upload failed, but health update saved:', uploadError);
                    setError('Health update saved, but some files failed to upload. You can try uploading them again later.');
                    // Don't throw - continue with the rest
                }
            }

            // Add to visit history
            try {
                await supabase.from('patient_visit_history').insert({
                    patient_name: patientName,
                    phone: bed.activeQueue?.phone,
                    visit_date: new Date().toISOString(),
                    diagnosis: disease,
                    treatment: healthCondition,
                    medications: additionalInfo,
                    doctor_name: wardBoyName,
                    bed_queue_id: bedQueueId
                });
            } catch (historyError) {
                console.error('Failed to save visit history:', historyError);
                // Don't fail the whole operation
            }

            onUpdate();
            onClose();
        } catch (err) {
            console.error('Error submitting health update:', err);
            setError(err.message || 'Failed to submit health update');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Patient Health Update</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Patient Info */}
                    <div className="bg-blue-50 p-4 rounded-lg mb-6">
                        <h3 className="font-semibold text-lg mb-2">Patient Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">Name</p>
                                <p className="font-medium">{patientName}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Disease</p>
                                <p className="font-medium">{disease}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Bed</p>
                                <p className="font-medium">{bed.bed_number}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Bed Type</p>
                                <p className="font-medium capitalize">{bed.bed_type}</p>
                            </div>
                        </div>
                    </div>

                    {/* Visit History */}
                    {visitHistory.length > 0 && (
                        <div className="bg-yellow-50 p-4 rounded-lg mb-6">
                            <h3 className="font-semibold mb-2">Previous Visits</h3>
                            <div className="space-y-2">
                                {visitHistory.map((visit, idx) => (
                                    <div key={idx} className="text-sm">
                                        <span className="font-medium">{new Date(visit.visit_date).toLocaleDateString()}</span>
                                        {' - '}{visit.diagnosis} {visit.treatment && `(${visit.treatment})`}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Ward Boy Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Your Name (Ward Boy/Nurse) *
                            </label>
                            <input
                                type="text"
                                value={wardBoyName}
                                onChange={(e) => setWardBoyName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        {/* Health Condition */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Current Health Condition *
                            </label>
                            <textarea
                                value={healthCondition}
                                onChange={(e) => setHealthCondition(e.target.value)}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Describe the patient's current condition..."
                                required
                            />
                        </div>

                        {/* Vital Signs */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Vital Signs</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <input
                                    type="text"
                                    placeholder="Blood Pressure (e.g., 120/80)"
                                    value={vitalSigns.bloodPressure}
                                    onChange={(e) => setVitalSigns({...vitalSigns, bloodPressure: e.target.value})}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Heart Rate (bpm)"
                                    value={vitalSigns.heartRate}
                                    onChange={(e) => setVitalSigns({...vitalSigns, heartRate: e.target.value})}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Temperature (°F)"
                                    value={vitalSigns.temperature}
                                    onChange={(e) => setVitalSigns({...vitalSigns, temperature: e.target.value})}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Oxygen Level (%)"
                                    value={vitalSigns.oxygenLevel}
                                    onChange={(e) => setVitalSigns({...vitalSigns, oxygenLevel: e.target.value})}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Respiratory Rate"
                                    value={vitalSigns.respiratoryRate}
                                    onChange={(e) => setVitalSigns({...vitalSigns, respiratoryRate: e.target.value})}
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Symptoms */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Symptoms</label>
                            <textarea
                                value={symptoms}
                                onChange={(e) => setSymptoms(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="List any symptoms..."
                            />
                        </div>

                        {/* Additional Info */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Additional Information
                            </label>
                            <textarea
                                value={additionalInfo}
                                onChange={(e) => setAdditionalInfo(e.target.value)}
                                rows={2}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Medications, treatments, notes..."
                            />
                        </div>

                        {/* File Uploads */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Upload Medical Records
                            </label>
                            <div className="space-y-2">
                                {['lab_report', 'xray', 'ct_scan', 'mri', 'ecg', 'prescription', 'machine_report', 'other'].map(type => (
                                    <div key={type}>
                                        <label className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
                                            <input
                                                type="file"
                                                multiple
                                                onChange={(e) => handleFileChange(e, type)}
                                                className="hidden"
                                                accept="image/*,.pdf"
                                            />
                                            <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                            
                            {files.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {files.map(f => (
                                        <div key={f.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                            <span className="text-sm">{f.file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(f.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                Remove
                                            </button>
                                            {uploadProgress[f.id] > 0 && (
                                                <span className="text-sm text-green-600">{uploadProgress[f.id]}%</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* AI Prediction Display */}
                        {/* Get AI Prediction button - show estimated discharge before submitting */}
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!healthCondition.trim()) {
                                        setError('Enter health condition first');
                                        return;
                                    }
                                    await getAIPrediction(
                                        { healthCondition, vitalSigns, symptoms, additionalInfo },
                                        visitHistory,
                                        files
                                    );
                                }}
                                disabled={aiLoading || !GROQ_API_KEY}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {aiLoading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                        Getting AI prediction...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-lg">psychology</span>
                                        Estimate discharge time (AI)
                                    </>
                                )}
                            </button>
                            {!GROQ_API_KEY && (
                                <span className="text-xs text-amber-600">Set VITE_GROQ_API_KEY in .env</span>
                            )}
                        </div>

                        {aiPrediction && (
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-xl">psychology</span>
                                    AI Prediction – Estimated Discharge
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <p>
                                        <span className="font-medium text-gray-700">Estimated Discharge:</span>{' '}
                                        <span className="text-green-700 font-semibold">{aiPrediction.estimatedDischargeDate}</span>
                                    </p>
                                    <p>
                                        <span className="font-medium text-gray-700">Care Plan:</span>{' '}
                                        <span className="text-gray-600">{aiPrediction.carePlan}</span>
                                    </p>
                                    <p>
                                        <span className="font-medium text-gray-700">Risk Level:</span>{' '}
                                        <span className={`font-semibold ${
                                            aiPrediction.riskLevel === 'low' ? 'text-green-600' :
                                            aiPrediction.riskLevel === 'moderate' ? 'text-yellow-600' :
                                            'text-red-600'
                                        }`}>
                                            {aiPrediction.riskLevel?.toUpperCase()}
                                        </span>
                                    </p>
                                    {aiPrediction.warnings && (
                                        <p className="bg-red-50 p-2 rounded border border-red-200">
                                            <span className="font-medium text-red-700">⚠️ Warnings:</span>{' '}
                                            <span className="text-red-600">{aiPrediction.warnings}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Submit Buttons */}
                        <div className="flex gap-4">
                            <button
                                type="submit"
                                disabled={loading || aiLoading}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Submitting...' : aiLoading ? 'Getting AI Prediction...' : 'Submit Update'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}