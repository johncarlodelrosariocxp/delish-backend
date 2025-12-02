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

    // Add Vercel-specific headers for better CORS handling
    if (IS_VERCEL) {
      config.headers["Origin"] = FRONTEND_URL;
      config.headers["Referer"] = FRONTEND_URL;
      config.headers["X-Forwarded-Host"] = FRONTEND_URL;
    }

    console.log(
      `📤 API Request: ${config.method?.toUpperCase()} ${config.url}`
    );
    return config;
  },
  (error) => {
    console.error("❌ Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor with Vercel-specific handling
axiosWrapper.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response [${response.status}]: ${response.config.url}`);

    // Auto-save token from login/signup responses
    if (
      response.data &&
      (response.config.url.includes("/login") ||
        response.config.url.includes("/register") ||
        response.config.url.includes("/force-create-user"))
    ) {
      const token = response.data.token || response.data.data?.token;
      if (token) {
        localStorage.setItem("authToken", token);
        console.log("🔑 Token saved to localStorage");
      }
    }

    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const message = error.message;

    console.error(`❌ API Error [${status}]:`, message);
    console.error("Frontend (Vercel):", FRONTEND_URL);
    console.error("Backend (Render):", API_BASE_URL);
    console.error("Endpoint:", url);

    // Handle CORS errors
    if (
      error.message.includes("CORS") ||
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNREFUSED"
    ) {
      error.userMessage = `
🚨 CORS BLOCKED - Vercel cannot access Render

Your Vercel Frontend: ${FRONTEND_URL}
Render Backend: ${API_BASE_URL}

REQUIRED FIX:
1. Update backend CORS to include: "${FRONTEND_URL}"
2. Or allow all origins temporarily: "*"
3. Make sure backend is awake (Render free tier sleeps)

TEST CONNECTION:
// Run in browser console
fetch("${API_BASE_URL}", {
  mode: 'cors',
  headers: { 'Accept': 'application/json' }
})
.then(r => console.log("Status:", r.status, r.statusText))
.then(r => r.text())
.then(d => console.log("Response:", d))
.catch(e => console.error("Error:", e));

// Create emergency user with CORS mode
fetch("${API_BASE_URL}/api/force-create-user", {
  method: 'POST',
  mode: 'cors',
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
          const alertMsg = `CORS Issue Detected!\n\nVercel Frontend: ${FRONTEND_URL}\nRender Backend: ${API_BASE_URL}\n\n1. Check if backend is awake\n2. Update backend CORS to allow: ${FRONTEND_URL}\n3. Check browser console for details`;
          console.warn(alertMsg);
          alert(alertMsg);
        }, 2000);
      }
    }

    // Clear token on 401 Unauthorized
    if (status === 401) {
      localStorage.removeItem("authToken");
      console.log("🔓 Token cleared due to 401 Unauthorized");

      // Redirect to login if not already there
      if (
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register")
      ) {
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
      }
    }

    return Promise.reject(error);
  }
);

// Test connection specifically for Vercel
export const testVercelConnection = async () => {
  console.group("🔍 Vercel → Render Connection Test");

  try {
    // Test with fetch using CORS mode
    const response = await fetch(API_BASE_URL, {
      method: "GET",
      mode: "cors",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    console.log("✅ Backend is reachable");
    console.log("Status:", response.status, response.statusText);
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
      fix2: `Make sure backend server is awake (Render free tier sleeps after inactivity)`,
    };
  }
};

// Test backend endpoint
export const testBackendEndpoint = async (endpoint = "/") => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      mode: "cors",
      headers: { Accept: "application/json" },
    });

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      url: `${API_BASE_URL}${endpoint}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      url: `${API_BASE_URL}${endpoint}`,
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
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(userData),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { text: await response.text() };
    }

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
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(credentials),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = { text: await response.text() };
    }

    return {
      success: response.ok,
      status: response.status,
      data: data,
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
export const getAuthToken = () => localStorage.getItem("authToken");
export const setAuthToken = (token) => localStorage.setItem("authToken", token);
export const removeAuthToken = () => localStorage.removeItem("authToken");

// Auto-run tests
if (typeof window !== "undefined") {
  setTimeout(() => {
    console.log("🔧 Auto-testing Vercel ↔ Render connection...");

    // Only test if we're on Vercel
    if (IS_VERCEL) {
      testVercelConnection().then((result) => {
        if (!result.success) {
          console.error("❌ CORS ISSUE DETECTED");
          console.error("Error:", result.error);
          console.error("Fix:", result.fix);
          console.error("Fix 2:", result.fix2);

          // Also test specific endpoints
          testBackendEndpoint("/api/user/login").then((loginResult) => {
            console.log(
              "Login endpoint test:",
              loginResult.success ? "✅ Accessible" : "❌ Blocked"
            );
          });

          testBackendEndpoint("/api/force-create-user").then((createResult) => {
            console.log(
              "Create user endpoint test:",
              createResult.success ? "✅ Accessible" : "❌ Blocked"
            );
          });

          // Try emergency user creation
          createEmergencyUser().then((userResult) => {
            console.log(
              "Emergency user attempt:",
              userResult.success ? "✅ Success" : "❌ Failed"
            );
          });
        } else {
          console.log("🎉 Vercel ↔ Render connection successful!");

          // Test login endpoint for good measure
          testLoginEndpoint().then((loginTest) => {
            console.log(
              "Login endpoint:",
              loginTest.success ? "✅ Working" : "❌ Not working"
            );
          });
        }
      });
    } else {
      console.log("🖥️ Running locally, skipping Vercel-specific tests");
    }
  }, 3000);
}

// Export
export {
  axiosWrapper as default,
  axiosWrapper,
  API_BASE_URL,
  testVercelConnection,
  testBackendEndpoint,
  createEmergencyUser,
  testLoginEndpoint,
  isAuthenticated,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
};
