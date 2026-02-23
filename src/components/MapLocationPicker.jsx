import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue in React-Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Custom red marker for hospital location
const hospitalIcon = new L.Icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: 'hospital-marker'
});

// Location Marker Component - handles map click events
function LocationMarker({ position, onPositionChange }) {
    useMapEvents({
        click(e) {
            onPositionChange({ lat: e.latlng.lat, lng: e.latlng.lng });
        },
    });

    return position ? (
        <Marker 
            position={position} 
            icon={hospitalIcon}
            draggable={true}
            eventHandlers={{
                dragend: (e) => {
                    const marker = e.target;
                    const newPos = marker.getLatLng();
                    onPositionChange({ lat: newPos.lat, lng: newPos.lng });
                },
            }}
        />
    ) : null;
}
export default function MapLocationPicker({ onLocationSelect, initialLocation = null }) {
    // Default to Mumbai if no initial location
    const defaultLocation = { lat: 19.0760, lng: 72.8777 };
    const [position, setPosition] = useState(initialLocation || defaultLocation);

    // Common hospital locations in India for quick selection
    const PRESET_LOCATIONS = useMemo(() => [
        { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
        { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
        { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
        { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
        { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
        { name: 'Pune', lat: 18.5204, lng: 73.8567 },
        { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
        { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
        { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
        { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
        { name: 'Kanpur', lat: 26.4499, lng: 80.3319 },
        { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
        { name: 'Indore', lat: 22.7196, lng: 75.8577 },
        { name: 'Thane', lat: 19.2183, lng: 72.9781 },
        { name: 'Bhopal', lat: 23.2599, lng: 77.4126 },
    ], []);

    const handlePositionChange = (newPosition) => {
        setPosition(newPosition);
        onLocationSelect?.(newPosition);
    };

    const handleManualInput = (field, value) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            const newPosition = { ...position, [field]: numValue };
            setPosition(newPosition);
            onLocationSelect?.(newPosition);
        }
    };

    return (
        <div className="space-y-4">
            {/* Quick Location Presets */}
            <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase self-center">Quick Select:</span>
                {PRESET_LOCATIONS.map((loc) => (
                    <button
                        key={loc.name}
                        type="button"
                        onClick={() => handlePositionChange({ lat: loc.lat, lng: loc.lng })}
                        className="px-2 py-1 text-xs bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded transition-colors border border-slate-200 hover:border-blue-300"
                    >
                        {loc.name}
                    </button>
                ))}
            </div>

            {/* OpenStreetMap Container */}
            <div className="relative">
                <div className="h-72 rounded-xl overflow-hidden border-2 border-slate-200 shadow-inner">
                    <MapContainer
                        center={[position.lat, position.lng]}
                        zoom={13}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker 
                            position={[position.lat, position.lng]} 
                            onPositionChange={handlePositionChange}
                        />
                    </MapContainer>
                </div>
                
                {/* Map Instructions Overlay */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full text-xs text-slate-600 shadow-lg backdrop-blur-sm border border-slate-200 z-[1000]">
                    Click anywhere on map or drag marker to set location
                </div>
            </div>

            {/* Coordinate Inputs */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Latitude
                    </label>
                    <input
                        type="number"
                        step="0.000001"
                        value={position.lat.toFixed(6)}
                        onChange={(e) => handleManualInput('lat', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                        placeholder="19.0760"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                        Longitude
                    </label>
                    <input
                        type="number"
                        step="0.000001"
                        value={position.lng.toFixed(6)}
                        onChange={(e) => handleManualInput('lng', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                        placeholder="72.8777"
                    />
                </div>
            </div>

            {/* Selected Location Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-500">location_on</span>
                <div className="flex-1">
                    <p className="text-xs text-blue-600 font-medium">Selected Hospital Location</p>
                    <p className="text-sm text-blue-800 font-mono">
                        {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                    </p>
                </div>
            </div>

            {/* Custom CSS for marker */}
            <style>{`
                .hospital-marker {
                    filter: hue-rotate(140deg) saturate(1.5);
                }
                .leaflet-container {
                    font-family: inherit;
                }
            `}</style>
        </div>
    );
}
