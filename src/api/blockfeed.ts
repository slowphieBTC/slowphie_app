import axios from 'axios';

const BASE = 'https://api.blockfeed.online/v1';

const client = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'Accept': 'application/json' },
});

export const blockfeed = {
  async status() {
    const { data } = await client.get('/status');
    return data;
  },

  async getAddress(addr: string) {
    const { data } = await client.get(`/address/${addr}`);
    return data;
  },

  async getTransaction(hash: string) {
    const { data } = await client.get(`/tx/${hash}`);
    return data;
  },

  async getTokens() {
    const { data } = await client.get('/tokens');
    return data;
  },

  async getOraclePrices() {
    const { data } = await client.get('/oracle/all');
    return data;
  },

  async getLatestBlock() {
    const { data } = await client.get('/blocks/latest');
    return data;
  },

  async getRecentEvents() {
    const { data } = await client.get('/events/recent');
    return data;
  },

  async getFees() {
    const { data } = await client.get('/fees/latest');
    return data;
  },

  async search(q: string) {
    const { data } = await client.get('/search', { params: { q } });
    return data;
  },
};
