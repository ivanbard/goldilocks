import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fetcher = (url) => fetch(url).then((res) => res.json());

export function useApi(path, options = {}) {
  const { refreshInterval = 0, ...rest } = options;
  return useSWR(`${API_URL}${path}`, fetcher, { refreshInterval, ...rest });
}

export function useDashboard() {
  return useApi('/api/dashboard', { refreshInterval: 30000 });
}

export function useSavings(period = 'all') {
  return useApi(`/api/savings?period=${period}`);
}

export function useUser() {
  return useApi('/api/user');
}

export function useNotifications() {
  return useApi('/api/notifications', { refreshInterval: 60000 });
}

export function useReadings(deviceId, limit = 1440) {
  return useApi(`/api/readings?device_id=${deviceId}&limit=${limit}`);
}

export async function postPreferences(data) {
  const res = await fetch(`${API_URL}/api/user/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function postAction(data) {
  const res = await fetch(`${API_URL}/api/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export function useCarbon() {
  return useApi('/api/carbon', { refreshInterval: 60000 });
}

export async function markNotificationRead(id) {
  const res = await fetch(`${API_URL}/api/notifications/${id}/read`, {
    method: 'POST',
  });
  return res.json();
}

export async function generateSuggestions() {
  const res = await fetch(`${API_URL}/api/suggestions/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function sendChatMessage(message) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function resetChatSession() {
  const res = await fetch(`${API_URL}/api/chat/reset`, {
    method: 'POST',
  });
  return res.json();
}

export { API_URL };
