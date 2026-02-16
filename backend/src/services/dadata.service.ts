import axios from 'axios';

const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party';

export interface DadataOrg {
  name: string;
  inn: string;
  kpp?: string | null;
  address?: string | null;
}

export async function findOrgByInn(inn: string): Promise<DadataOrg | null> {
  const apiKey = process.env.DADATA_API_KEY;
  if (!apiKey) {
    throw new Error('DADATA_API_KEY is not configured');
  }

  const query = String(inn || '').trim();
  if (!query) {
    return null;
  }

  const resp = await axios.post(
    DADATA_URL,
    { query },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      timeout: 5000,
    },
  );

  const suggestions = resp.data?.suggestions;
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return null;
  }

  const s = suggestions[0];
  const data = s.data || {};

  return {
    name: data.name?.full_with_opf || data.name?.short_with_opf || s.value || '',
    inn: data.inn || '',
    kpp: data.kpp || null,
    address: data.address?.value || null,
  };
}
