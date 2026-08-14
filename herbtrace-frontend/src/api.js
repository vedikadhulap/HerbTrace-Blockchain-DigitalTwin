import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000", // change this to your backend's actual port
});

export default api;