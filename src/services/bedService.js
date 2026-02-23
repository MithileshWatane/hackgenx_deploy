import { supabase } from '../lib/supabase';

// Get ICU beds for current doctor
export const getICUBeds = async (doctorId) => {
  const { data, error } = await supabase
    .from('icu_beds')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('bed_id');
  
  if (error) throw error;
  return data;
};

// Add a new ICU bed
export const addICUBed = async (bedData, doctorId) => {
  const { data, error } = await supabase
    .from('icu_beds')
    .insert([{ ...bedData, doctor_id: doctorId }])
    .select();
  
  if (error) throw error;
  return data[0];
};

// Update an ICU bed
export const updateICUBed = async (id, updates) => {
  const { data, error } = await supabase
    .from('icu_beds')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

// Delete an ICU bed
export const deleteICUBed = async (id) => {
  const { error } = await supabase
    .from('icu_beds')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Get bed statistics
export const getBedStats = async () => {
  const { data, error } = await supabase
    .from('icu_beds')
    .select('*');
  
  if (error) throw error;
  
  const total = data.length;
  const available = data.filter(bed => bed.is_available).length;
  const withVentilator = data.filter(bed => bed.ventilator_available).length;
  const withDialysis = data.filter(bed => bed.dialysis_available).length;
  
  return {
    total,
    available,
    occupied: total - available,
    withVentilator,
    withDialysis,
    utilizationRate: total > 0 ? ((total - available) / total * 100).toFixed(1) : 0
  };
};
