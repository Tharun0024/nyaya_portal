import type { AnalyzeResponse } from '../api';
import type { AIAnalysisProvider } from './AIProvider';
import type { RoleId, ConcernId } from '../domain';
import { roleLabel, concernLabel } from '../domain';
import { analyzeDocument } from '../api';

export class NvidiaProvider implements AIAnalysisProvider {
  async analyze(pdfBase64: string, roleId: RoleId, concernId: ConcernId): Promise<AnalyzeResponse> {
    return analyzeDocument({
      pdfBase64,
      role: roleLabel(roleId),
      concern: concernLabel(concernId),
    });
  }
}