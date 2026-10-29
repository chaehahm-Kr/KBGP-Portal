import * as fs from 'fs';
import * as path from 'path';

/**
 * DEV-DB-AUTO-001: Verified TLS Configuration Module
 * Strictly enforces valid certificate checking via official Supabase Root CA.
 * FORBIDS rejectUnauthorized: false in production and automated execution.
 */

export const DEFAULT_SUPABASE_CA_PATH = path.join(process.cwd(), 'supabase', 'certs', 'prod-ca-2021.crt');

export interface VerifiedTlsOptions {
  ca: string;
  rejectUnauthorized: true;
  servername?: string;
}

/**
 * Resolves verified TLS configuration using the official Supabase Root 2021 CA certificate.
 * Throws a fatal security error if the certificate file is missing or empty.
 */
export function getVerifiedTlsConfig(host: string, customCertPath?: string): VerifiedTlsOptions {
  // Prevent global bypass
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error(
      '[FATAL SECURITY VIOLATION] NODE_TLS_REJECT_UNAUTHORIZED=0 detected in environment! ' +
      'Bypassing TLS verification globally is strictly prohibited. Unset this variable to proceed.'
    );
  }

  const certPath = customCertPath || DEFAULT_SUPABASE_CA_PATH;

  if (!fs.existsSync(certPath)) {
    throw new Error(
      `[FATAL SECURITY VIOLATION] Supabase Root CA certificate not found at "${certPath}". ` +
      'Automated migration execution requires verified TLS transport with the official Supabase Root CA.'
    );
  }

  const caContent = fs.readFileSync(certPath, 'utf8').trim();
  if (!caContent || !caContent.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error(
      `[FATAL SECURITY VIOLATION] Invalid or corrupt CA certificate at "${certPath}". ` +
      'Expected valid PEM formatted certificate.'
    );
  }

  return {
    ca: caContent,
    rejectUnauthorized: true,
    servername: host
  };
}
