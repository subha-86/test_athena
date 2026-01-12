import axios from "axios";

const erpApi = axios.create({
  baseURL: "https://erp.athena-logistics.com:8080/",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// Request interceptor for logging
erpApi.interceptors.request.use((config) => {
  console.log("ERP API REQUEST:", {
    url: config.url,
    method: config.method,
    data: config.data,
    headers: config.headers,
  });
  return config;
});

// Response interceptor for error handling
erpApi.interceptors.response.use(
  (response) => {
    console.log("ERP API RESPONSE:", {
      url: response.config.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error("ERP API ERROR:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default erpApi;

