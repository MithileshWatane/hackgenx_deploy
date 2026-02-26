import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-replace-in-production';

export class SecurityService {
  /**
   * Encrypt sensitive PHI data
   */
  static encryptPHI(data: string): string {
    if (!process.env.PHI_ENCRYPTION_ENABLED) {
      return data;
    }
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  /**
   * Decrypt sensitive PHI data
   */
  static decryptPHI(encryptedData: string): string {
    if (!process.env.PHI_ENCRYPTION_ENABLED) {
      return encryptedData;
    }
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Mask sensitive data in logs
   */
  static maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      return this.maskString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }
    
    if (typeof data === 'object' && data !== null) {
      const masked: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          masked[key] = '***MASKED***';
        } else {
          masked[key] = this.maskSensitiveData(value);
        }
      }
      return masked;
    }
    
    return data;
  }

  private static isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'ssn', 'password', 'token', 'secret', 'apikey', 
      'creditcard', 'cvv', 'pin', 'encryptedssn',
      'encryptedaddress', 'dateofbirth', 'dob'
    ];
    return sensitiveFields.some(field => 
      fieldName.toLowerCase().includes(field)
    );
  }

  private static maskString(str: string): string {
    // Mask SSN patterns (XXX-XX-XXXX)
    str = str.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****');
    
    // Mask credit card patterns
    str = str.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '****-****-****-****');
    
    // Mask email addresses partially
    str = str.replace(/\b([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)\b/g, 
      (match, user, domain) => `${user.substring(0, 2)}***@${domain}`);
    
    return str;
  }

  /**
   * Validate tool payload schemas
   */
  static validateToolPayload(tool: string, payload: any): boolean {
    // Add Zod validation schemas for each tool
    // For now, basic validation
    if (!payload || typeof payload !== 'object') {
      return false;
    }
    return true;
  }

  /**
   * Check role-based permissions
   */
  static hasPermission(roles: string[], requiredPermission: string): boolean {
    const rolePermissions: Record<string, string[]> = {
      doctor: ['read:patients', 'write:appointments', 'read:schedule', 'write:reminders'],
      admin: ['read:*', 'write:*', 'delete:*'],
      agent: ['read:patients', 'write:appointments', 'write:messages', 'read:schedule']
    };

    for (const role of roles) {
      const permissions = rolePermissions[role] || [];
      if (permissions.includes(requiredPermission) || permissions.includes('read:*') || permissions.includes('write:*')) {
        return true;
      }
    }
    
    return false;
  }
}
