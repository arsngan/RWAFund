/**
 * data.js — RWA Index definitions
 *
 * Each index token represents a basket of tokenized real-world assets
 * deployed on IOPn OPN Chain (Chain ID 984).
 *
 * Contract addresses are placeholders — replace with deployed addresses
 * after running `npm run deploy` in /contracts/.
 */

const INDICES = [
  {
    id: 0,
    name: 'Treasury Index',
    ticker: 'TSY-IDX',
    description: 'Diversified basket of tokenized government bonds: US, EU, Japan, UK',
    color: '#1D9E75',
    iconClass: 'ti-building-bank',
    nav: 1.0412,
    change: 0.18,
    apy: 4.8,
    tvl: '42.1M',
    // Placeholder — update after contract deployment
    contractAddress: '0x0000000000000000000000000000000000000001',
    tagClass: 'tag-tsy',
    assets: [
      { name: 'US T-Bill 6M',    dot: '#1D9E75', issuer: 'US Treasury',  weight: 35, yield: 5.28, nav: '$98.70'  },
      { name: 'EU Sovereign',     dot: '#5DCAA5', issuer: 'ECB',           weight: 25, yield: 3.42, nav: '$103.20' },
      { name: 'JP Gov Bond',      dot: '#0F6E56', issuer: 'MOF Japan',     weight: 20, yield: 0.78, nav: '$99.40'  },
      { name: 'UK Gilt 2Y',       dot: '#9FE1CB', issuer: 'HM Treasury',   weight: 20, yield: 4.91, nav: '$101.30' },
    ],
  },
  {
    id: 1,
    name: 'Real Estate Index',
    ticker: 'REFI-IDX',
    description: 'Tokenized real estate investment trusts across NYC, Singapore, Dubai, London',
    color: '#EF9F27',
    iconClass: 'ti-building',
    nav: 0.9871,
    change: -0.42,
    apy: 6.2,
    tvl: '28.4M',
    contractAddress: '0x0000000000000000000000000000000000000002',
    tagClass: 'tag-re',
    assets: [
      { name: 'NYC Commercial',   dot: '#EF9F27', issuer: 'Arca Finance',  weight: 30, yield: 7.10, nav: '$47.20' },
      { name: 'SG Retail Fund',   dot: '#FAC775', issuer: 'Mapletree',     weight: 28, yield: 5.88, nav: '$31.50' },
      { name: 'Dubai Office',     dot: '#BA7517', issuer: 'ENBD REIT',     weight: 22, yield: 6.72, nav: '$22.10' },
      { name: 'London Resident.', dot: '#FAEEDA', issuer: 'Propine',       weight: 20, yield: 5.44, nav: '$18.90' },
    ],
  },
  {
    id: 2,
    name: 'Commodity Index',
    ticker: 'CMDTY-IDX',
    description: 'Tokenized physical commodities: gold, silver, crude oil, agricultural basket',
    color: '#D85A30',
    iconClass: 'ti-grain',
    nav: 1.1204,
    change: 1.13,
    apy: 3.1,
    tvl: '19.7M',
    contractAddress: '0x0000000000000000000000000000000000000003',
    tagClass: 'tag-com',
    assets: [
      { name: 'Gold (PAXG)',      dot: '#D85A30', issuer: 'Paxos',         weight: 40, yield: 0.00, nav: '$2,341' },
      { name: 'Silver Token',     dot: '#F09595', issuer: 'Silvertree',    weight: 25, yield: 0.00, nav: '$28.40' },
      { name: 'Crude Oil Future', dot: '#993C1D', issuer: 'Brent DAO',     weight: 20, yield: 4.20, nav: '$78.90' },
      { name: 'Agri Basket',      dot: '#FAECE7', issuer: 'AgriDEX',       weight: 15, yield: 2.80, nav: '$12.70' },
    ],
  },
  {
    id: 3,
    name: 'EM Credit Index',
    ticker: 'EMC-IDX',
    description: 'High-yield sovereign and corporate debt from emerging markets: VN, BR, IN, MX',
    color: '#7F77DD',
    iconClass: 'ti-world',
    nav: 0.9543,
    change: -0.07,
    apy: 8.4,
    tvl: '34.5M',
    contractAddress: '0x0000000000000000000000000000000000000004',
    tagClass: 'tag-em',
    assets: [
      { name: 'VN Gov Bond 5Y',  dot: '#7F77DD', issuer: 'State Tsy VN',  weight: 30, yield: 9.10, nav: '$98.20' },
      { name: 'BR Corp Note',    dot: '#AFA9EC', issuer: 'Itaú BBA',       weight: 25, yield: 8.50, nav: '$97.80' },
      { name: 'IN SME Loan Pool',dot: '#534AB7', issuer: 'Fasanara',       weight: 25, yield: 10.20,nav: '$96.40' },
      { name: 'MX Infra Bond',   dot: '#EEEDFE', issuer: 'BBVA Mex',       weight: 20, yield: 7.80, nav: '$99.10' },
    ],
  },
];
