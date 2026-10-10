import type { PipelineDetails } from '../types';

interface PipelineBoxProps {
    customerId: string;
    details: PipelineDetails;
}

export default function PipelineBox({ customerId, details }: PipelineBoxProps) {
    const formatPct = (val?: number) => val ? `${(val * 100).toFixed(1)}%` : '-';

    const getSeverityColor = (severity: string) => {
        switch (severity?.toLowerCase()) {
            case 'high': return 'text-red-500';
            case 'medium': return 'text-amber-500';
            case 'low': return 'text-emerald-500';
            default: return 'text-zinc-400';
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
            <div className="text-xs font-black text-zinc-900 mb-4 uppercase tracking-wider">
                {customerId}
            </div>

            <div className="space-y-4 text-[10px]">
                <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">ML SCORE</div>
                    <div className="flex gap-3">
                        <div className="bg-zinc-50 rounded-xl px-3 py-2 flex-1">
                            <div className="text-[8px] text-zinc-400 uppercase">LGB</div>
                            <div className="text-sm font-black text-zinc-900">{formatPct(details.lgb_p)}</div>
                        </div>
                        <div className="bg-zinc-50 rounded-xl px-3 py-2 flex-1">
                            <div className="text-[8px] text-zinc-400 uppercase">GRU</div>
                            <div className="text-sm font-black text-zinc-900">{formatPct(details.gru_p)}</div>
                        </div>
                        <div className="bg-zinc-50 rounded-xl px-3 py-2 flex-1">
                            <div className="text-[8px] text-zinc-400 uppercase">ENS</div>
                            <div className={`text-sm font-black ${(details.risk_score || 0) >= 0.5 ? 'text-red-500' : 'text-zinc-900'}`}>
                                {formatPct(details.risk_score)}
                            </div>
                        </div>
                    </div>
                </div>

                {details.top_factors && details.top_factors.length > 0 && (
                    <div>
                        <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">SHAP</div>
                        <div className="space-y-1">
                            {details.top_factors.slice(0, 3).map((shap, idx) => (
                                <div key={idx} className="flex justify-between items-center text-[9px]">
                                    <span className="text-zinc-600 truncate max-w-[100px]">{shap.feature}</span>
                                    <span className={`font-bold ${shap.direction === 'increases_risk' ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {shap.direction === 'increases_risk' ? '↑' : '↓'} {shap.contribution.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {details.stress_context && details.stress_context.stress_type && (
                    <div>
                        <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">ANALYST</div>
                        <div className="space-y-1 text-[9px]">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Type:</span>
                                <span className="text-zinc-700 font-medium">{details.stress_context.stress_type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Severity:</span>
                                <span className={`font-bold ${getSeverityColor(details.stress_context.severity)}`}>
                                    {details.stress_context.severity || '-'}
                                </span>
                            </div>
                            {details.stress_context.narrative && (
                                <div className="text-zinc-500 truncate mt-1 italic">
                                    "{details.stress_context.narrative.slice(0, 60)}..."
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">COMPLIANCE</div>
                    <div className="space-y-1 text-[9px]">
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Hard Stop:</span>
                            <span className={`font-bold ${details.compliance?.hard_stop ? 'text-red-500' : 'text-emerald-500'}`}>
                                {details.compliance?.hard_stop ? 'Yes' : 'No'}
                            </span>
                        </div>
                        {details.compliance?.eligible_interventions && details.compliance.eligible_interventions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {details.compliance.eligible_interventions.map((int, idx) => (
                                    <span key={idx} className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded text-[8px]">
                                        {int}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">INTERVENTION</div>
                    <div className="space-y-1 text-[9px]">
                        <div className="flex justify-between">
                            <span className="text-zinc-400">Method:</span>
                            <span className="text-zinc-700 font-medium">{details.intervention?.method || '-'}</span>
                        </div>
                        {details.intervention?.justification && (
                            <div className="text-zinc-500 truncate mt-1 italic">
                                {details.intervention.justification.slice(0, 80)}...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
