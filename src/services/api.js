const axios = require('axios');

/**
 * Servicio genérico para peticiones a APIs externas adicionales.
 * Puede servir para buscar eventos culturales, validaciones externas, etc.
 */
class ApiService {
    constructor(baseURL) {
        this.client = axios.create({
            baseURL: baseURL,
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    /**
     * Ejemplo: GET Method
     */
    async get(endpoint, params = {}) {
        try {
            const response = await this.client.get(endpoint, { params });
            return response.data;
        } catch (error) {
            console.error(`[API GET ERROR] -> ${endpoint}:`, error.message);
            throw error;
        }
    }

    /**
     * Ejemplo: POST Method
     */
    async post(endpoint, data = {}) {
        try {
            const response = await this.client.post(endpoint, data);
            return response.data;
        } catch (error) {
            console.error(`[API POST ERROR] -> ${endpoint}:`, error.message);
            throw error;
        }
    }
}

// Instancia por defecto (exportable como singleton)
const defaultApi = new ApiService(process.env.EXTERNAL_API_BASE_URL || 'https://api.ejemplo.muni.gob.ar/v1');

module.exports = {
    ApiService,
    defaultApi
};
