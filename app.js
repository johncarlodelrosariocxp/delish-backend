import axios from "axios";

// 🚀 RENDER BACKEND URL
const API_BASE_URL = "https://delish-backend-1.onrender.com";

// Get current frontend URL
const FRONTEND_URL = window.location.origin;
const IS_VERCEL = FRONTEND_URL.includes("vercel.app");

console.log("🚀 Frontend Platform:", IS_VERCEL ? "Vercel" : "Local");
console.log("📍 Frontend URL:", FRONTEND_URL);
console.log("🔗 Backend URL:", API_BASE_URL);
console.log("🔄 Testing Vercel ↔ Render connection...");

// Create Axios instance optimized for Vercel
const axiosWrapper = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false, // CRITICAL: Must be false for Vercel → Render
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Auth interceptor
axiosWrapper.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add Vercel-specific headers
    if (IS_VERCEL) {
      config.headers["X-Vercel-Forwarded-For"] = FRONTEND_URL;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with Vercel-specific handling
axiosWrapper.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;

    console.error(`❌ API Error [${status}]:`, error.message);
    console.error("Frontend (Vercel):", FRONTEND_URL);
    console.error("Backend (Render):", API_BASE_URL);
    console.error("Endpoint:", url);

    // Handle CORS errors
    if (error.message.includes("CORS") || error.code === "ERR_NETWORK") {
      error.userMessage = `
🚨 CORS BLOCKED - Vercel cannot access Render

Your frontend: ${FRONTEND_URL}
Backend: ${API_BASE_URL}

REQUIRED FIX:
1. Update backend CORS to include: "${FRONTEND_URL}"
2. Or allow all Vercel domains: "https://*.vercel.app"

EMERGENCY WORKAROUND:
Run this in browser console to test connection:

// Test CORS
fetch("${API_BASE_URL}")
  .then(r => console.log("Status:", r.status))
  .catch(e => console.error("Error:", e));

// Create emergency user
fetch("${API_BASE_URL}/api/force-create-user", {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({
    name: "Admin",
    email: "admin@delish.com",
    password: "admin123",
    role: "admin"
  })
})
.then(r => r.json())
.then(d => console.log("User:", d))
.catch(e => console.error("Error:", e));
      `;

      // Show alert on login page
      if (window.location.pathname.includes("/login")) {
        setTimeout(() => {
          alert(
            `CORS Issue Detected!\n\nFrontend: ${FRONTEND_URL}\nBackend: ${API_BASE_URL}\n\nUpdate backend CORS configuration.`
          );
        }, 2000);
      }
    }

    return Promise.reject(error);
  }
);

// Test connection specifically for Vercel
export const testVercelConnection = async () => {
  console.group("🔍 Vercel → Render Connection Test");

  try {
    // Test basic connection
    const response = await fetch(API_BASE_URL);
    const data = await response.json();

    console.log("✅ Backend is reachable");
    console.log("Status:", response.status);
    console.log("Data:", data);
    console.groupEnd();

    return {
      success: true,
      status: response.status,
      data: data,
      message: `Vercel (${FRONTEND_URL}) can access Render backend`,
    };
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    console.groupEnd();

    return {
      success: false,
      error: error.message,
      frontend: FRONTEND_URL,
      backend: API_BASE_URL,
      fix: `Add "${FRONTEND_URL}" to backend CORS allowedOrigins array`,
    };
  }
};

// Emergency user creation (bypass CORS if possible)
export const createEmergencyUser = async (
  userData = {
    name: "Admin User",
    email: "admin@delish.com",
    phone: "1234567890",
    password: "admin123",
    role: "admin",
  }
) => {
  try {
    console.log("🚨 Attempting emergency user creation...");

    const response = await fetch(`${API_BASE_URL}/api/force-create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    console.log("Emergency user result:", data);

    return {
      success: response.ok,
      data: data,
      status: response.status,
    };
  } catch (error) {
    console.error("Emergency user creation failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Quick login test
export const testLoginEndpoint = async (
  credentials = {
    email: "admin@delish.com",
    password: "admin123",
  }
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(credentials),
    });

    return {
      success: response.ok,
      status: response.status,
      message: `Login endpoint: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Auth helpers
export const isAuthenticated = () => !!localStorage.getItem("authToken");
export const setAuthToken = (token) => localStorage.setItem("authToken", token);
export const removeAuthToken = () => localStorage.removeItem("authToken");

// Auto-run tests
if (typeof window !== "undefined") {
  setTimeout(() => {
    console.log("🔧 Auto-testing Vercel ↔ Render connection...");
    testVercelConnection().then((result) => {
      if (!result.success) {
        console.error("❌ CORS ISSUE DETECTED");
        console.error("Fix:", result.fix);

        // Try emergency user creation
        createEmergencyUser().then((userResult) => {
          console.log(
            "Emergency user attempt:",
            userResult.success ? "✅ Success" : "❌ Failed"
          );
        });
      }
    });
  }, 3000);
}

// Export
export {
  axiosWrapper as default,
  axiosWrapper,
  API_BASE_URL,
  testVercelConnection,
  createEmergencyUser,
  testLoginEndpoint,
};
