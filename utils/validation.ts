import { ValidationError } from '@/types/auth';

export const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/(?=.*[a-z])/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/(?=.*[A-Z])/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/(?=.*\d)/.test(password)) return 'Password must contain at least one number';
  if (!/(?=.*[@$!%*?&])/.test(password)) return 'Password must contain at least one special character';
  return null;
};

export const validateConfirmPassword = (password: string, confirmPassword: string): string | null => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

export const validateFullName = (fullName: string): string | null => {
  if (!fullName) return 'Full name is required';
  if (fullName.trim().length < 2) return 'Full name must be at least 2 characters';
  return null;
};

export const validateOTP = (otp: string): string | null => {
  if (!otp) return 'OTP is required';
  if (!/^\d{6}$/.test(otp)) return 'OTP must be 6 digits';
  return null;
};

export const validateForm = (formData: any, validationRules: { [key: string]: (value: any) => string | null }): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  Object.keys(validationRules).forEach(field => {
    const error = validationRules[field](formData[field]);
    if (error) {
      errors.push({ field, message: error });
    }
  });
  
  return errors;
};