export function isValidPhoneNumber(phone) {
  if (!phone) return false;
  // Remove spaces, hyphens, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, "");
  // Check if it starts with 0, has 10 characters, and contains only digits
  return /^0\d{9}$/.test(cleaned);
}
