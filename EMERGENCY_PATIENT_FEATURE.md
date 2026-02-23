# Emergency Patient Feature

## Overview
This feature allows doctors to mark patients as emergency cases during appointment booking. Emergency patients bypass the OPD queue and are added directly to the ICU queue for immediate attention.

## Changes Made

### 1. Database Migration
- **File**: `supabase/migration_add_emergency_field.sql`
- Added `is_emergency` boolean column to the `appointments` table
- Created index for better query performance

### 2. Frontend Changes

#### Doctor Dashboard - Appointment Scheduling
- **File**: `src/pages/AppointmentScheduling.jsx`
- Added emergency patient checkbox in the appointment form
- Updated form state to include `is_emergency` field
- Modified submit logic to:
  - Add emergency patients directly to ICU queue
  - Add regular patients to OPD queue (existing behavior)
- Updated success banner to show different information for emergency vs regular appointments
- Changed button styling and text based on emergency status

#### Patient Dashboard - Self Booking
- **File**: `src/pages/PatientDashboard.jsx`
- Added emergency patient checkbox in the patient self-booking form
- Updated form state to include `is_emergency` field
- Modified submit logic to route emergency patients to ICU queue
- Updated success banner with emergency-specific styling and information
- Dynamic button styling (red for emergency, blue for regular)

### 3. Backend Changes

#### Controller
- **File**: `backend/controllers/appointmentController.js`
- Added `isEmergency` parameter handling
- Updated response to include queue type (ICU or OPD)
- Different response messages for emergency appointments

#### Service
- **File**: `backend/services/supabaseService.js`
- Updated `bookAppointment()` to handle `isEmergency` flag
- Added new method `addToICUQueue()` to insert emergency patients into ICU queue
- Modified queue routing logic based on emergency status

## How It Works

### From Doctor Dashboard (AppointmentScheduling.jsx)

1. **Doctor books appointment**: Doctor fills out the appointment form and checks the "Emergency Patient" checkbox if needed

2. **Emergency patient flow**:
   - Appointment is created with `is_emergency = true`
   - Patient is added directly to `icu_queue` table
   - Status set as "waiting" with severity "critical"
   - Success message shows "Emergency appointment booked! Patient added directly to ICU Queue"

3. **Regular patient flow** (unchanged):
   - Appointment is created with `is_emergency = false`
   - Patient is added to `opd_queue` table
   - Queue position and estimated wait time calculated
   - Success message shows "Appointment booked! Patient added to OPD Queue"

### From Patient Dashboard (PatientDashboard.jsx)

1. **Patient self-books appointment**: Patient fills out the appointment form and can check the "Emergency Patient" checkbox if they have an emergency

2. **Emergency patient flow**:
   - Appointment is created with `is_emergency = true`
   - Patient is added directly to `icu_queue` table
   - Status set as "waiting" with severity "critical"
   - Success message shows "Emergency appointment booked! You have been added directly to ICU Queue"

3. **Regular patient flow** (unchanged):
   - Appointment is created with `is_emergency = false`
   - Patient is added to `opd_queue` table
   - Queue position and estimated wait time calculated
   - Success message shows "Appointment booked successfully!"

## Database Schema

### appointments table (new column)
```sql
is_emergency BOOLEAN DEFAULT false
```

### icu_queue table (existing)
- `patient_token`: Token number from appointment
- `patient_name`: Patient's name
- `diseases`: Patient's condition
- `is_emergency`: Set to true for emergency patients
- `severity`: Set to "critical" for emergency patients
- `status`: Set to "waiting" initially

## UI/UX Features

### Appointment Forms (Doctor & Patient Dashboard)
- Red-themed emergency checkbox with warning icon
- Dynamic button color (red for emergency, blue for regular)
- Different success banners:
  - Emergency: Red gradient with "EMERGENCY" and "ICU" badges
  - Regular: Green gradient with queue position and wait time
- Clear visual distinction between emergency and regular appointments

### ICU Queue Page
- Emergency patients displayed with red background (bg-red-50)
- Red left border (4px) for emergency patient rows
- Emergency badge with pulsing animation next to patient name
- Emergency patients always sorted to the top of the queue
- Avatar with red gradient and pulsing indicator for emergency patients
- Visual priority indicators to help staff identify critical cases immediately

## Testing

To test the feature:

### Doctor Dashboard
1. Run the database migration: `supabase/migration_add_emergency_field.sql`
2. Login as a doctor
3. Navigate to Appointment Scheduling page
4. Fill out appointment form
5. Check "Emergency Patient" checkbox
6. Submit form
7. Verify patient appears in ICU queue (not OPD queue)
8. Test regular appointment (unchecked) to ensure OPD queue still works

### Patient Dashboard
1. Login as a patient
2. Navigate to Patient Dashboard
3. Go to "Book Appointment" tab
4. Fill out appointment form
5. Check "Emergency Patient" checkbox
6. Submit form
7. Verify patient appears in ICU queue (not OPD queue)
8. Test regular appointment (unchecked) to ensure OPD queue still works

## Future Enhancements

- Add emergency priority levels (critical, urgent, moderate)
- Automatic notification to ICU staff when emergency patient added
- Emergency patient analytics and reporting
- Integration with ambulance/emergency services
- Emergency patient triage workflow
- Real-time alerts for emergency admissions
- Emergency patient transfer protocols
