export const oispahalla_endpoint = "https://oispahalla.com";

export class TokenValidationResult {
  valid!: boolean;
  error_code!: number; // 0 = success, 1 = parsing json failed, 2 = invalid response from endpoint
  user_data!: null | {
    name: string;
    uid: string;
    email: string;
    email_verified: boolean;
    picture: string;
  };
}
export async function validate_token(
  token: string
): Promise<TokenValidationResult> {
  let response = await fetch(`${oispahalla_endpoint}/auth/validate`, {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
    }),
  });

  if (response.ok) {
    try {
      let json = await response.json();
      if (Object.keys(json).includes("info")) {
        console.log(`UID validated: ${json.info.uid}`);
        return {
          valid: true,
          error_code: 0,
          user_data: json.info,
        };
      } else {
        // Invalid data
        return {
          valid: false,
          error_code: 2,
          user_data: null,
        };
      }
    } catch (e) {
      console.warn("Error validating token:", e);
      return {
        valid: false,
        error_code: 1,
        user_data: null,
      };
    }
  }
  // Response not ok
  return {
    valid: false,
    error_code: response.status,
    user_data: null,
  };
}
