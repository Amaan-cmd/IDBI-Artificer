/**
 * Microsoft Azure Enterprise Configuration for EnverAI Artificer Citadel
 * Powers Azure Entra ID (Active Directory), Azure Container Apps, & Azure Blob Telemetry.
 */

export const azureConfig = {
  // Microsoft Entra ID (Azure AD) Client Config
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "00000000-0000-0000-0000-000000000000",
    authority: import.meta.env.VITE_AZURE_AUTHORITY || "https://login.microsoftonline.com/organizations",
    redirectUri: typeof window !== 'undefined' ? window.location.origin : "https://artificer.enveraitech.in"
  },
  
  // Azure Cloud Region & Ingress Endpoints
  cloud: {
    region: import.meta.env.VITE_AZURE_REGION || "centralindia",
    apiEndpoint: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:4000"),
    customDomain: "artificer.enveraitech.in"
  },

  // Sovereign Underwriting Sentinel
  telemetry: {
    ledgerName: "AZURE_CITADEL_SOVEREIGN_LEDGER",
    complianceStandard: "RBI Digital Lending Policy v2026 / ISO 27001"
  }
};

export default azureConfig;
