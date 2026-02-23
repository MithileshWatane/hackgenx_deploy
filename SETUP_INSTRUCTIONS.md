# Emergency Patient Feature - Setup Instructions

## Prerequisites
- Supabase project with existing database
- Backend server running
- Frontend application running

## Step-by-Step Setup

### 1. Run Database Migration

Execute the migration file to add the `is_emergency` column to the appointments table:

```bash
# Option 1: Using Supabase CLI
supabase db push supabase/migration_add_emergency_field.sql

# Option 2: Using Supabase Dashboard
# 1. Go to your Supabase project dashboard
# 2. Navigate to SQL Editor
# 3. Copy and paste the contents of supabase/migration_add_emergency_field.sql
# 4. Click "Run"
```

### 2. Restart Backend Server

The backend changes are already in place. Simply restart your backend server:

```bash
cd backend
npm restart
# or
node app.js
```

### 3. Restart Frontend Application

The frontend changes are already in place. Restart your frontend:

```bash
npm run dev
# or
yarn dev
```

### 4. Verify the Feature

#### Test from Doctor Dashboard
1. **Login as a doctor**
2. **Navigate to Appointment Scheduling page**
3. **Fill out the appointment form**
4. **Check the "Emergency Patient" checkbox**
5. **Submit the form**
6. **Verify**:
   - Success message shows "Emergency appointment booked! Patient added directly to ICU Queue"
   - Patient appears in ICU Queue (not OPD Queue)
   - Token number is displayed
   - Emergency badge shows "EMERGENCY" and "ICU"

#### Test from Patient Dashboard
1. **Login as a patient**
2. **Navigate to Patient Dashboard**
3. **Click on "Book Appointment" tab**
4. **Fill out the appointment form**
5. **Check the "Emergency Patient" checkbox**
6. **Submit the form**
7. **Verify**:
   - Success message shows "Emergency appointment booked! You have been added directly to ICU Queue"
   - Patient appears in ICU Queue (not OPD Queue)
   - Token number is displayed
   - Emergency badge shows "EMERGENCY" and "ICU"

### 5. Test Regular Appointments

#### From Doctor Dashboard
1. **Fill out another appointment form**
2. **Leave "Emergency Patient" checkbox unchecked**
3. **Submit the form**
4. **Verify**:
   - Success message shows "Appointment booked! Patient added to OPD Queue"
   - Patient appears in OPD Queue
   - Queue position and estimated wait time are shown

#### From Patient Dashboard
1. **Fill out another appointment form**
2. **Leave "Emergency Patient" checkbox unchecked**
3. **Submit the form**
4. **Verify**:
   - Success message shows "Appointment booked successfully!"
   - Patient appears in OPD Queue
   - Queue position and estimated wait time are shown

## Files Modified

### Frontend
- `src/pages/AppointmentScheduling.jsx` - Added emergency checkbox and routing logic (Doctor Dashboard)
- `src/pages/PatientDashboard.jsx` - Added emergency checkbox and routing logic (Patient Dashboard)
- `src/components/ShiftToICUModal.jsx` - Set is_emergency to false by default for ICU transfers
- `src/pages/ICUQueuePage.jsx` - Added emergency patient highlighting and priority sorting

### Backend
- `backend/controllers/appointmentController.js` - Added emergency handling
- `backend/services/supabaseService.js` - Added ICU queue insertion logic

### Database
- `supabase/migration_add_emergency_field.sql` - New migration file

### Documentation
- `EMERGENCY_PATIENT_FEATURE.md` - Feature documentation
- `SETUP_INSTRUCTIONS.md` - This file

## Troubleshooting

### Issue: "Column is_emergency does not exist"
**Solution**: Run the database migration (Step 1)

### Issue: Emergency patients still going to OPD queue
**Solution**: 
1. Check if migration was applied successfully
2. Verify backend server was restarted
3. Check browser console for errors

### Issue: Checkbox not appearing
**Solution**: 
1. Clear browser cache
2. Restart frontend dev server
3. Check for JavaScript errors in console

### Issue: ICU queue insert fails
**Solution**: 
1. Verify `icu_queue` table exists in database
2. Check RLS policies allow inserts
3. Review backend logs for specific error

## Support

For issues or questions, check:
- Backend logs: `backend/` directory
- Frontend console: Browser DevTools
- Database logs: Supabase Dashboard > Logs
