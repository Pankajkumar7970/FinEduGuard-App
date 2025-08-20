export interface LoginForm {
  email: string;
  password: string;
}

export interface SignupForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordForm {
  email: string;
}

export interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

export interface OTPForm {
  otp: string;
}

export interface ValidationError {
  field: string;
  message: string;
}