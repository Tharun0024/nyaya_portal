import type { AnalyzeResponse } from '../api';
import type { RoleId, ConcernId } from '../domain';

export interface AIAnalysisProvider {
  /**
   * Analyzes the document bytes based on a typed role and concern.
   *
   * @param pdfBase64 - The document as a base64 string.
   * @param roleId    - Stable typed identifier for the user's role.
   * @param concernId - Stable typed identifier for the user's primary concern.
   */
  analyze(pdfBase64: string, roleId: RoleId, concernId: ConcernId): Promise<AnalyzeResponse>;
}
