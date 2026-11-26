import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export const checkHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export const getStats = async () => {
  const response = await apiClient.get('/stats');
  return response.data;
};

export const forecastTraffic = async (features) => {
  const response = await apiClient.post('/traffic/forecast', features);
  return response.data;
};

export const analyzeAttack = async (payload) => {
  const response = await apiClient.post('/attack/analyze', payload);
  return response.data;
};

export const generateReport = async (payload) => {
  const response = await apiClient.post('/report/generate', payload);
  return response.data;
};

export const analyzeClient = async (payload) => {
  const response = await apiClient.post('/client/analyze', payload);
  return response.data;
};

export const getLiveDatasets = async () => {
  const response = await apiClient.get('/live/datasets');
  return response.data;
};

export const getLiveState = async () => {
  const response = await apiClient.get('/live/state');
  return response.data;
};

export const controlLive = async (actionData) => {
  const response = await apiClient.post('/live/control', actionData);
  return response.data;
};

export const uploadLiveDataset = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post('/live/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const ingestLiveRequest = async (payload) => {
  const response = await apiClient.post('/live/ingest', payload);
  return response.data;
};

export default apiClient;

