import axios from 'axios';
import { API_BASE_URL, axiosInstance } from '../config';

const notesApi = axiosInstance.create({
  baseURL: `${API_BASE_URL}/api/notes`,
});

export const create = async (note) => {
  const response = await notesApi.post('/', note);
  return response.data;
};

export const update = async (id, note) => {
  const response = await notesApi.put(`/${id}`, note);
  return response.data;
};

export const deleteNote = async (id) => {
  await notesApi.delete(`/${id}`);
};

export const getAll = async () => {
  const response = await notesApi.get('/');
  return response.data;
};

export const getById = async (id) => {
  const response = await notesApi.get(`/${id}`);
  return response.data;
};

export default {
  create,
  update,
  delete: deleteNote,
  getAll,
  getById,
};