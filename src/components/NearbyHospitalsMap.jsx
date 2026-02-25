import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Fix default marker issue */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* Custom hospital icon */
const hospitalIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2967/2967350.png",
  iconSize: [32, 32],
});

/* Recenter map when user location changes */
function RecenterMap({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 13);
    }
  }, [lat, lng, map]);

  return null;
}

export default function NearbyHospitalsMap() {
  const [userLocation, setUserLocation] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Get user current location */
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        setError("Location access denied");
        setLoading(false);
      }
    );
  }, []);

  /* Fetch hospitals after location is available */
  useEffect(() => {
    if (!userLocation) return;

    const fetchHospitals = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/hospitals/nearby?lat=${userLocation.lat}&lng=${userLocation.lng}`
        );

        const result = await response.json();

        if (result.status === "success") {
          setHospitals(result.data);
        } else {
          setError("Failed to fetch hospitals");
        }
      } catch (err) {
        setError("Server error");
      } finally {
        setLoading(false);
      }
    };

    fetchHospitals();
  }, [userLocation]);

  if (loading) {
    return (
      <div className="h-[500px] flex items-center justify-center">
        Loading nearby hospitals...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[500px] flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-4">Nearby Hospitals</h2>

      <div className="h-[600px] w-full rounded-xl overflow-hidden shadow-lg">
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User Marker */}
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>
              <strong>Your Location</strong>
            </Popup>
          </Marker>

          {/* Hospital Markers */}
          {hospitals.map((hospital) => (
            <Marker
              key={hospital.id}
              position={[hospital.latitude, hospital.longitude]}
              icon={hospitalIcon}
            >
              <Popup>
                <div className="w-56">
                  <h3 className="font-semibold text-red-600">
                    {hospital.name}
                  </h3>

                  <p className="text-sm text-gray-600">
                    {hospital.city}, {hospital.state}
                  </p>

                  <p className="text-xs text-gray-500">{hospital.country}</p>

                  <div className="mt-2 text-sm">
                    🛏 Beds Available:{" "}
                    <strong>{hospital.total_beds_available}</strong>
                  </div>

                  <div className="text-sm">
                    📍 Distance: <strong>{hospital.distance} km</strong>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
