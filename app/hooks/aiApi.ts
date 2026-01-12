import axios from "axios";

const aiApi = axios.create({
  baseURL: "https://sailwithcrm-athena.reportqube.com/api",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// Request interceptor for logging
aiApi.interceptors.request.use((config) => {
  console.log("AI API REQUEST:", {
    url: config.url,
    method: config.method,
    data: config.data,
    headers: config.headers,
  });
  return config;
});

// Response interceptor for error handling
aiApi.interceptors.response.use(
  (response) => {
    console.log("AI API RESPONSE:", {
      url: response.config.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error("AI API ERROR:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default aiApi;

