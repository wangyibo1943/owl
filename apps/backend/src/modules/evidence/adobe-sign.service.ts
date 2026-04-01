import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

type AdobeAgreementStatus =
  | 'AUTHORING'
  | 'DRAFT'
  | 'IN_PROCESS'
  | 'OUT_FOR_SIGNATURE'
  | 'OUT_FOR_APPROVAL'
  | 'SIGNED'
  | 'APPROVED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ABORTED'
  | string;

@Injectable()
export class AdobeSignService {
  private readonly apiBaseUrl =
    process.env.ADOBE_SIGN_API_BASE_URL?.trim() ||
    'https://api.na1.adobesign.com';

  private readonly refreshPath =
    process.env.ADOBE_SIGN_OAUTH_REFRESH_PATH?.trim() || '/oauth/refresh';

  isConfigured() {
    return Boolean(
      process.env.ADOBE_SIGN_ACCESS_TOKEN?.trim() ||
        (process.env.ADOBE_SIGN_CLIENT_ID?.trim() &&
          process.env.ADOBE_SIGN_CLIENT_SECRET?.trim() &&
          process.env.ADOBE_SIGN_REFRESH_TOKEN?.trim()),
    );
  }

  async createAgreement(payload: {
    filename: string;
    mimeType: string;
    fileContentBase64: string;
    companyName?: string | null;
  }) {
    const accessToken = await this.getAccessToken();
    const transientDocumentId = await this.uploadTransientDocument({
      accessToken,
      filename: payload.filename,
      mimeType: payload.mimeType,
      fileContentBase64: payload.fileContentBase64,
    });

    const signerEmail = process.env.ADOBE_SIGN_SIGNER_EMAIL?.trim();
    const signerName =
      process.env.ADOBE_SIGN_SIGNER_NAME?.trim() || 'TradeGuard Signer';

    if (!signerEmail) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'CONFIGURATION_ERROR',
        message: 'ADOBE_SIGN_SIGNER_EMAIL is not configured',
      });
    }

    const agreementName = payload.companyName?.trim()
      ? `TradeGuard Evidence - ${payload.companyName.trim()}`
      : `TradeGuard Evidence - ${payload.filename}`;

    const response = await fetch(`${this.apiBaseUrl}/api/rest/v6/agreements`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        fileInfos: [{ transientDocumentId }],
        name: agreementName,
        participantSetsInfo: [
          {
            order: 1,
            role: 'SIGNER',
            memberInfos: [
              {
                email: signerEmail,
                name: signerName,
              },
            ],
          },
        ],
        signatureType: 'ESIGN',
        state: 'IN_PROCESS',
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ADOBE_SIGN_PROVIDER_ERROR',
        message: `Adobe Sign agreement creation returned ${response.status}`,
      });
    }

    const agreement = (await response.json()) as {
      id?: string;
      status?: AdobeAgreementStatus;
    };

    if (!agreement.id) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ADOBE_SIGN_PROVIDER_ERROR',
        message: 'Adobe Sign did not return an agreement id',
      });
    }

    return {
      agreementId: agreement.id,
      agreementStatus: agreement.status ?? 'IN_PROCESS',
      rawPayload: agreement as Record<string, unknown>,
    };
  }

  async getAgreement(agreementId: string) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `${this.apiBaseUrl}/api/rest/v6/agreements/${encodeURIComponent(agreementId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ADOBE_SIGN_PROVIDER_ERROR',
        message: `Adobe Sign agreement lookup returned ${response.status}`,
      });
    }

    return (await response.json()) as Record<string, unknown>;
  }

  async downloadAgreementCombinedDocument(agreementId: string) {
    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `${this.apiBaseUrl}/api/rest/v6/agreements/${encodeURIComponent(agreementId)}/combinedDocument`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          accept: 'application/pdf',
        },
      },
    );

    if (!response.ok) {
      throw new NotFoundException({
        success: false,
        error_code: 'CERTIFICATE_DOWNLOAD_FAILED',
        message: 'Adobe Sign certificate file could not be downloaded',
      });
    }

    return {
      content: Buffer.from(await response.arrayBuffer()),
      contentType:
        response.headers.get('content-type')?.split(';')[0].trim() ||
        'application/pdf',
    };
  }

  mapAgreementStatus(status: string) {
    const normalized = status.trim().toUpperCase();

    if (['SIGNED', 'APPROVED', 'COMPLETED'].includes(normalized)) {
      return 'COMPLETED';
    }

    if (
      ['AUTHORING', 'DRAFT', 'IN_PROCESS', 'OUT_FOR_SIGNATURE', 'OUT_FOR_APPROVAL'].includes(
        normalized,
      )
    ) {
      return 'IN_PROGRESS';
    }

    if (['CANCELLED', 'EXPIRED', 'ABORTED'].includes(normalized)) {
      return 'FAILED';
    }

    return 'IN_PROGRESS';
  }

  private async uploadTransientDocument(input: {
    accessToken: string;
    filename: string;
    mimeType: string;
    fileContentBase64: string;
  }) {
    const formData = new FormData();
    const buffer = Buffer.from(input.fileContentBase64, 'base64');

    formData.append('File-Name', input.filename);
    formData.append('Mime-Type', input.mimeType);
    formData.append(
      'File',
      new Blob([buffer], { type: input.mimeType }),
      input.filename,
    );

    const response = await fetch(
      `${this.apiBaseUrl}/api/rest/v6/transientDocuments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          accept: 'application/json',
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ADOBE_SIGN_PROVIDER_ERROR',
        message: `Adobe Sign transient document upload returned ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      transientDocumentId?: string;
    };

    if (!payload.transientDocumentId) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ADOBE_SIGN_PROVIDER_ERROR',
        message: 'Adobe Sign did not return a transient document id',
      });
    }

    return payload.transientDocumentId;
  }

  private async getAccessToken() {
    const staticAccessToken = process.env.ADOBE_SIGN_ACCESS_TOKEN?.trim();

    if (staticAccessToken) {
      return staticAccessToken;
    }

    const clientId = process.env.ADOBE_SIGN_CLIENT_ID?.trim();
    const clientSecret = process.env.ADOBE_SIGN_CLIENT_SECRET?.trim();
    const refreshToken = process.env.ADOBE_SIGN_REFRESH_TOKEN?.trim();

    if (!clientId || !clientSecret || !refreshToken) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'CONFIGURATION_ERROR',
        message:
          'Adobe Sign credentials are incomplete. Configure access token or refresh-token credentials.',
      });
    }

    const refreshUrl = `${this.apiBaseUrl}${this.refreshPath}`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ADOBE_SIGN_PROVIDER_ERROR',
        message: `Adobe Sign token refresh returned ${response.status}`,
      });
    }

    const payload = (await response.json()) as {
      access_token?: string;
    };

    if (!payload.access_token) {
      throw new InternalServerErrorException({
        success: false,
        error_code: 'ADOBE_SIGN_PROVIDER_ERROR',
        message: 'Adobe Sign did not return an access token',
      });
    }

    return payload.access_token;
  }
}
