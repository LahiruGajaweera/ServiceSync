import { useState } from "react";
import { isValidPhoneNumber } from "../utils/validation";

export default function PhoneInput({ value, onChange, name, className, required, placeholder, id }) {
  const [touched, setTouched] = useState(false);
  const isValid = isValidPhoneNumber(value);
  
  // Only show error if they touched the field and it's invalid, OR if they typed at least 10 chars and it's invalid
  const showError = value && !isValid && (touched || value.length >= 10);
  const showSuccess = value && isValid;

  // We extract the base border classes from the incoming className if they exist,
  // or we just append our validation classes to the provided className.
  
  let finalClassName = className || "";
  if (showError) {
    finalClassName = finalClassName.replace(/border-gray-300|dark:border-gray-600|focus:ring-blue-500/g, "") + " border-red-400 focus:ring-red-500 bg-red-50 dark:bg-red-900/10";
  } else if (showSuccess) {
    finalClassName = finalClassName.replace(/border-gray-300|dark:border-gray-600|focus:ring-blue-500/g, "") + " border-green-400 focus:ring-green-500 bg-green-50 dark:bg-green-900/10";
  }

  return (
    <div>
      <input
        id={id}
        type="tel"
        name={name}
        value={value}
        onChange={onChange}
        onBlur={() => setTouched(true)}
        required={required}
        placeholder={placeholder}
        className={finalClassName}
        autoComplete="off"
      />
      {showSuccess && <p className="text-[10px] text-green-600 font-semibold mt-1">Valid phone number</p>}
      {showError && <p className="text-[10px] text-red-500 font-semibold mt-1">Invalid phone number</p>}
    </div>
  );
}
