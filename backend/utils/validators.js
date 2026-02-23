export const validateAppointment = (data) => {
  const { name, age, phone, email } = data;

  if (!name || name.trim().length < 2) {
    return "Name must be at least 2 characters long";
  }

  if (!age || age < 1 || age > 120) {
    return "Age must be between 1 and 120";
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phone || !phoneRegex.test(phone)) {
    return "Phone number must be 10 digits";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return "Valid email is required";
  }

  return null;
};
