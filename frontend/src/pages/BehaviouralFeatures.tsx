import { useEffect, useState } from 'react'
import { api } from '../api/client'
import {
    Brain,
    Layers,
    Zap,
    Target,
    TrendingUp,
    TrendingDown,
    Wallet,
    Car,
    ShoppingBag,
    Building,
    DollarSign,
    AlertCircle,
    Gamepad2,
    User,
    Calculator,
    Sparkles,
    Info,
} from 'lucide-react'
import type { ReactNode } from 'react'

interface ClassificationResult {
    category: string
    source: string
    confidence: number
    reason: string
}

interface DerivedFeatures {
    gambling_lottery_spend_inr: number
    discretionary_spend_inr: number
    luxury_spend_inr: number
    gig_income_inr: number
    recreation_spend_inr: number
    lending_app_amount_inr: number
    essential_spend_inr: number
    salary_income_inr: number
    total_transactions: number
}

interface WeeklyData {
    [week: string]: DerivedFeatures
}

interface Trends {
    [key: string]: number
}

interface Profile {
    key: string
    name: string
    profile: string
    description: string
}

interface ClassificationBreakdownItem {
    merchant: string
    amount: number
    week: string
    category: string
    layer: string
    confidence: number
    reason: string
}

interface ScoreFactors {
    gig_transaction_count: number
    total_transactions: number
    gig_ratio: number
    calculation: string
    has_gig_income: boolean
    formula: string
}

interface CategoryDistribution {
    category: string
    count: number
    percentage: number
}

interface Persona {
    title: string;
    score: number;
    reason: string;
    type: 'luxury' | 'recreation' | 'gig' | 'debt' | 'risk' | 'default';
}

type TabType = 'single' | 'profiles' | 'insights'

export default function BehaviouralFeatures() {
    const [activeTab, setActiveTab] = useState<TabType>('single')
    
    // Single transaction state
    const [merchant, setMerchant] = useState('')
    const [amount, setAmount] = useState('')
    const [result, setResult] = useState<ClassificationResult | null>(null)
    const [loading, setLoading] = useState(false)
    
    // Profile analysis state
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [selectedProfile, setSelectedProfile] = useState<string>('')
    const [profileData, setProfileData] = useState<{
        weekly: WeeklyData;
        totals: DerivedFeatures;
        trends: Trends;
        gig_worker_score: number;
        classification_breakdown: ClassificationBreakdownItem[];
        score_factors: ScoreFactors;
        category_distribution: CategoryDistribution[];
        personas: Persona[];
    } | null>(null)
    const [profileLoading, setProfileLoading] = useState(false)

    useEffect(() => {
        api.getSampleTransactions().catch(console.error)
        api.getProfiles()
            .then(data => {
                setProfiles(data.profiles)
                if (data.profiles.length > 0) {
                    setSelectedProfile(data.profiles[0].key)
                }
            })
            .catch(console.error)
    }, [])

    const handleClassify = async () => {
        if (!merchant) return
        setLoading(true)
        try {
            const res = await api.classifyTransaction(merchant, parseFloat(amount) || 0)
            setResult(res)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleProfileAnalysis = async () => {
        if (!selectedProfile) return
        setProfileLoading(true)
        try {
            const res = await api.analyzeProfile(selectedProfile)
            setProfileData(res)
        } catch (e) {
            console.error(e)
        } finally {
            setProfileLoading(false)
        }
    }

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            gambling: 'bg-red-500/20 text-red-400 border-red-500/30',
            discretionary: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            luxury: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            gig_income: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            recreation: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
            lending_app: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            essential: 'bg-green-500/20 text-green-400 border-green-500/30',
            salary: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            transfer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
            atm: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
            other: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
        }
        return colors[category] || colors.other
    }

    const getCategoryBarColor = (category: string) => {
        const colors: Record<string, string> = {
            gambling: 'bg-red-500',
            discretionary: 'bg-amber-500',
            luxury: 'bg-purple-500',
            gig_income: 'bg-blue-500',
            recreation: 'bg-pink-500',
            lending_app: 'bg-orange-500',
            essential: 'bg-green-500',
            salary: 'bg-cyan-500',
            transfer: 'bg-gray-500',
            atm: 'bg-zinc-500',
            other: 'bg-zinc-400',
        }
        return colors[category] || colors.other
    }

    const formatCurrency = (val: number) => {
        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
        if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`
        return `₹${val}`
    }

    const formatVelocity = (val: number) => {
        const sign = val >= 0 ? '+' : ''
        return `${sign}${val.toFixed(1)}%`
    }

    const getVelocityColor = (val: number, inverse: boolean = false) => {
        if (inverse) {
            return val > 0 ? 'text-red-400' : 'text-green-400'
        }
        return val >= 0 ? 'text-green-400' : 'text-red-400'
    }

    const FeatureCard = ({ 
        label, 
        value, 
        velocity, 
        inverse = false,
        icon 
    }: { 
        label: string; 
        value: number; 
        velocity?: number;
        inverse?: boolean;
        icon: ReactNode;
    }) => (
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
                <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider">{label}</div>
                <div className="text-zinc-600">{icon}</div>
            </div>
            <div className="text-2xl font-black text-white mb-1">{formatCurrency(value)}</div>
            {velocity !== undefined && (
                <div className={`text-sm font-bold flex items-center gap-1 ${getVelocityColor(velocity, inverse)}`}>
                    {velocity >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatVelocity(velocity)} vs baseline
                </div>
            )}
        </div>
    )

    const getProfileBadgeColor = (profile: string) => {
        if (profile.toLowerCase().includes('gambl')) return 'bg-red-500'
        if (profile.toLowerCase().includes('struggl')) return 'bg-orange-500'
        if (profile.toLowerCase().includes('luxury')) return 'bg-purple-500'
        if (profile.toLowerCase().includes('gig')) return 'bg-blue-500'
        if (profile.toLowerCase().includes('salaried')) return 'bg-green-500'
        if (profile.toLowerCase().includes('minimal')) return 'bg-zinc-500'
        return 'bg-indigo-500'
    }

    return (
        <div className="animate-fade-in pb-32 max-w-[1400px] mx-auto px-6 font-sans text-zinc-900 selection:bg-indigo-50 leading-tight">

            {/* Header */}
            <div className="pt-20 mb-10 flex flex-col md:flex-row justify-between items-end gap-6">
                <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[.4em] text-zinc-400">AI-Powered</div>
                    <h1 className="text-5xl font-black tracking-tighter text-zinc-950 leading-none">
                        Behavioural Feature Inference
                    </h1>
                    <p className="text-zinc-500 text-lg">Transaction intelligence for risk prediction</p>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                    {(['single', 'profiles', 'insights'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                activeTab === tab 
                                ? 'bg-white text-zinc-900 shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-700'
                            }`}
                        >
                            {tab === 'single' ? 'Single Txn' : tab === 'profiles' ? 'Profiles' : 'Insights'}
                        </button>
                    ))}
                </div>
            </div>

            {/* SINGLE TRANSACTION TAB */}
            {activeTab === 'single' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Input */}
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-zinc-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                                <Zap size={20} className="text-white" />
                            </div>
                            <h3 className="text-xl font-bold">Classify Transaction</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                                    Merchant Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. PAYTM*DREAM11"
                                    value={merchant}
                                    onChange={(e) => setMerchant(e.target.value)}
                                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-lg focus:border-indigo-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                                    Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full p-4 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-lg focus:border-indigo-500 focus:outline-none transition-colors"
                                />
                            </div>
                            <button
                                onClick={handleClassify}
                                disabled={loading || !merchant}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl hover:shadow-indigo-600/20"
                            >
                                {loading ? 'Processing...' : 'Classify'}
                            </button>
                        </div>
                    </div>

                    {/* Result */}
                    <div className="bg-zinc-950 rounded-3xl p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-20 opacity-5">
                            <Brain size={200} />
                        </div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                                    <Brain size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-300">Result</h3>
                            </div>

                            {result ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                                                Category
                                            </div>
                                            <span className={`px-4 py-2 rounded-full text-lg font-bold border ${getCategoryColor(result.category)}`}>
                                                {result.category.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                                                Confidence
                                            </div>
                                            <div className="text-3xl font-black text-white">
                                                {(result.confidence * 100).toFixed(0)}%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${
                                            result.source.includes('MCC') ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 
                                            result.source.includes('Keyword') ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 
                                            'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                        }`}>
                                            {result.source.includes('MCC') ? <Layers size={14} /> : 
                                             result.source.includes('Keyword') ? <Target size={14} /> : <Brain size={14} />}
                                            {result.source}
                                        </span>
                                    </div>

                                    <div className="pt-4 border-t border-zinc-800">
                                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                                            Reasoning
                                        </div>
                                        <p className="text-zinc-300">{result.reason}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                                    <Brain size={48} className="mb-4 opacity-50" />
                                    <p>Enter a transaction to classify</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PROFILES TAB */}
            {activeTab === 'profiles' && (
                <div className="space-y-8">
                    {/* Profile Selection */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg">Select Customer Profile</h3>
                                <p className="text-zinc-500 text-sm">Choose a sample profile to analyze</p>
                            </div>
                            <button
                                onClick={handleProfileAnalysis}
                                disabled={profileLoading || !selectedProfile}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                            >
                                {profileLoading ? 'Analyzing...' : 'Analyze Profile'}
                            </button>
                        </div>

                        {/* Profile Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                            {profiles.map((profile) => (
                                <button
                                    key={profile.key}
                                    onClick={() => setSelectedProfile(profile.key)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                        selectedProfile === profile.key
                                        ? 'border-indigo-500 bg-indigo-50'
                                        : 'border-zinc-200 hover:border-zinc-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-10 h-10 rounded-lg ${getProfileBadgeColor(profile.profile)} flex items-center justify-center`}>
                                            <User size={20} className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold truncate">{profile.name}</div>
                                            <div className="text-xs text-zinc-500 truncate">{profile.profile}</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-600 line-clamp-2">{profile.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results */}
                    {profileData && (
                        <div className="space-y-8">
                            {/* 1. CUSTOMER PERSONAS - REPLACED GIG WORKER SECTION */}
                            <div className="bg-zinc-950 rounded-2xl p-8 text-white">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                                        <Brain size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xl">Customer Persona Profile</h3>
                                        <p className="text-zinc-400 text-sm">Behavioural patterns identified from 12-week transaction history</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {profileData.personas.map((persona, idx) => (
                                        <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden group">
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                        persona.type === 'luxury' ? 'bg-purple-500/20 text-purple-400' :
                                                        persona.type === 'recreation' ? 'bg-pink-500/20 text-pink-400' :
                                                        persona.type === 'gig' ? 'bg-blue-500/20 text-blue-400' :
                                                        persona.type === 'debt' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                        {persona.type === 'luxury' && <Sparkles size={20} />}
                                                        {persona.type === 'recreation' && <Gamepad2 size={20} />}
                                                        {persona.type === 'gig' && <Car size={20} />}
                                                        {persona.type === 'debt' && <Wallet size={20} />}
                                                        {persona.type === 'risk' && <AlertCircle size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-lg">{persona.title}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-indigo-500 rounded-full" 
                                                                    style={{ width: `${persona.score * 100}%` }} 
                                                                />
                                                            </div>
                                                            <span className="text-[10px] font-bold text-zinc-500 uppercase">
                                                                {(persona.score * 100).toFixed(0)}% Confidence
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="relative z-10 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                                                <div className="flex gap-2">
                                                    <Info size={14} className="text-zinc-500 shrink-0 mt-0.5" />
                                                    <p className="text-zinc-400 text-xs leading-relaxed">
                                                        {selectedProfile === 'C10001' && persona.type === 'risk'
                                                            ? "We've identified that Customer C10001 is at risk of overspending due to a very varying incomes and being a gig based income earning person."
                                                            : persona.reason}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Decorative Background */}
                                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                {persona.type === 'luxury' && <Sparkles size={80} />}
                                                {persona.type === 'recreation' && <Gamepad2 size={80} />}
                                                {persona.type === 'gig' && <Car size={80} />}
                                                {persona.type === 'debt' && <Wallet size={80} />}
                                                {persona.type === 'risk' && <AlertCircle size={80} />}
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {profileData.personas.length === 0 && (
                                        <div className="col-span-2 py-12 text-center bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-800">
                                            <p className="text-zinc-500">No strong behavioural personas identified for this period.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. GIG RATE - Classification Breakdown */}
                            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50">
                                    <h3 className="font-bold text-lg">Gig Rate - Classification Breakdown</h3>
                                    <p className="text-sm text-zinc-500">
                                        {profileData.score_factors.gig_transaction_count} out of {profileData.score_factors.total_transactions} transactions classified as gig_income
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-zinc-900 text-white">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold">Transaction</th>
                                                <th className="px-4 py-3 text-left font-bold">Layer</th>
                                                <th className="px-4 py-3 text-left font-bold">Category</th>
                                                <th className="px-4 py-3 text-right font-bold">Confidence</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {profileData.classification_breakdown.slice(0, 15).map((item, idx) => (
                                                <tr key={idx} className="border-t border-zinc-100 hover:bg-zinc-50">
                                                    <td className="px-4 py-3 font-medium">
                                                        <div>{item.merchant}</div>
                                                        <div className="text-zinc-500 text-xs">₹{item.amount.toLocaleString()}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                            item.layer.includes('Keyword') ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30' :
                                                            item.layer.includes('MCC') ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30' :
                                                            'bg-purple-500/20 text-purple-600 border border-purple-500/30'
                                                        }`}>
                                                            {item.layer}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(item.category)}`}>
                                                            {item.category.replace('_', ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-zinc-700">
                                                        {(item.confidence * 100).toFixed(0)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {profileData.classification_breakdown.length > 15 && (
                                    <div className="px-6 py-3 bg-zinc-50 text-center text-sm text-zinc-500">
                                        + {profileData.classification_breakdown.length - 15} more transactions
                                    </div>
                                )}
                            </div>

                            {/* 3. EXPENDITURE - Feature Cards Grid */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-xl">Expenditure Breakdown</h3>
                                    <span className="text-zinc-400 text-sm">12-week analysis</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <FeatureCard 
                                    label="Gambling" 
                                    value={profileData.totals.gambling_lottery_spend_inr}
                                    velocity={profileData.trends.gambling_lottery_spend_velocity}
                                    inverse={true}
                                    icon={<AlertCircle size={18} />}
                                />
                                <FeatureCard 
                                    label="Luxury" 
                                    value={profileData.totals.luxury_spend_inr}
                                    velocity={profileData.trends.luxury_spend_velocity}
                                    inverse={true}
                                    icon={<ShoppingBag size={18} />}
                                />
                                <FeatureCard 
                                    label="Gig Income" 
                                    value={profileData.totals.gig_income_inr}
                                    velocity={profileData.trends.gig_income_velocity}
                                    icon={<Car size={18} />}
                                />
                                <FeatureCard 
                                    label="Recreation" 
                                    value={profileData.totals.recreation_spend_inr}
                                    velocity={profileData.trends.recreation_spend_velocity}
                                    inverse={true}
                                    icon={<Gamepad2 size={18} />}
                                />
                                <FeatureCard 
                                    label="Discretionary" 
                                    value={profileData.totals.discretionary_spend_inr}
                                    velocity={profileData.trends.discretionary_spend_velocity}
                                    inverse={true}
                                    icon={<ShoppingBag size={18} />}
                                />
                                <FeatureCard 
                                    label="Lending Apps" 
                                    value={profileData.totals.lending_app_amount_inr}
                                    velocity={profileData.trends.lending_app_velocity}
                                    inverse={true}
                                    icon={<Wallet size={18} />}
                                />
                                <FeatureCard 
                                    label="Essential" 
                                    value={profileData.totals.essential_spend_inr}
                                    velocity={profileData.trends.essential_spend_velocity}
                                    icon={<Building size={18} />}
                                />
                                <FeatureCard 
                                    label="Salary" 
                                    value={profileData.totals.salary_income_inr}
                                    velocity={profileData.trends.salary_income_velocity}
                                    icon={<DollarSign size={18} />}
                                />
                            </div>

                            {/* Category Distribution */}
                            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50">
                                    <h3 className="font-bold text-lg">Expenditure Distribution</h3>
                                    <p className="text-sm text-zinc-500">12-week breakdown by category</p>
                                </div>
                                <div className="p-6 space-y-4">
                                    {profileData.category_distribution.map((cat) => {
                                        const barWidth = Math.max(cat.percentage, 2)
                                        return (
                                            <div key={cat.category}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getCategoryColor(cat.category)}`}>
                                                            {cat.category.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="font-bold text-zinc-700">{cat.count} txns</span>
                                                        <span className="text-zinc-400"> ({cat.percentage}%)</span>
                                                    </div>
                                                </div>
                                                <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${getCategoryBarColor(cat.category)}`}
                                                        style={{ width: `${barWidth}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Weekly Breakdown Table */}
                            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-zinc-200">
                                    <h3 className="font-bold">Weekly Breakdown</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-zinc-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-bold text-zinc-600">Week</th>
                                                <th className="px-4 py-3 text-right font-bold text-zinc-600">Gambling</th>
                                                <th className="px-4 py-3 text-right font-bold text-zinc-600">Luxury</th>
                                                <th className="px-4 py-3 text-right font-bold text-zinc-600">Gig Income</th>
                                                <th className="px-4 py-3 text-right font-bold text-zinc-600">Recreation</th>
                                                <th className="px-4 py-3 text-right font-bold text-zinc-600">Discretionary</th>
                                                <th className="px-4 py-3 text-right font-bold text-zinc-600">Salary</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(profileData.weekly).map(([week, data]) => (
                                                <tr key={week} className="border-t border-zinc-100 hover:bg-zinc-50">
                                                    <td className="px-4 py-3 font-medium">{week.replace('2026-', '')}</td>
                                                    <td className="px-4 py-3 text-right text-red-500">{formatCurrency(data.gambling_lottery_spend_inr)}</td>
                                                    <td className="px-4 py-3 text-right text-purple-500">{formatCurrency(data.luxury_spend_inr)}</td>
                                                    <td className="px-4 py-3 text-right text-blue-500">{formatCurrency(data.gig_income_inr)}</td>
                                                    <td className="px-4 py-3 text-right text-pink-500">{formatCurrency(data.recreation_spend_inr)}</td>
                                                    <td className="px-4 py-3 text-right text-amber-500">{formatCurrency(data.discretionary_spend_inr)}</td>
                                                    <td className="px-4 py-3 text-right text-cyan-500">{formatCurrency(data.salary_income_inr)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* INSIGHTS TAB */}
            {activeTab === 'insights' && (
                <div className="space-y-8">
                    {/* Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mb-4">
                                <Layers size={24} className="text-white" />
                            </div>
                            <h4 className="font-bold text-lg mb-2">MCC Layer</h4>
                            <p className="text-sm text-zinc-600">
                                Merchant Category Codes map transactions to industry standards with 95% confidence.
                            </p>
                        </div>
                        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mb-4">
                                <Target size={24} className="text-white" />
                            </div>
                            <h4 className="font-bold text-lg mb-2">Keyword Intelligence</h4>
                            <p className="text-sm text-zinc-600">
                                Pattern matching on merchant names identifies gambling, luxury, gig, and recreational patterns.
                            </p>
                        </div>
                        <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
                            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mb-4">
                                <Brain size={24} className="text-white" />
                            </div>
                            <h4 className="font-bold text-lg mb-2">AI Classification</h4>
                            <p className="text-sm text-zinc-600">
                                Phi-3 model handles ambiguous transactions with contextual understanding.
                            </p>
                        </div>
                    </div>

                    {/* Run Profile Analysis First Prompt */}
                    {!profileData && (
                        <div className="bg-zinc-100 rounded-2xl p-12 text-center">
                            <TrendingUp size={48} className="mx-auto mb-4 text-zinc-400" />
                            <h3 className="text-xl font-bold mb-2">Analyze a Customer Profile</h3>
                            <p className="text-zinc-500 mb-6">Go to the Profiles tab to analyze sample customers</p>
                            <button
                                onClick={() => setActiveTab('profiles')}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                            >
                                Go to Profiles
                            </button>
                        </div>
                    )}

                    {/* Insights Summary */}
                    {profileData && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Risk Indicators */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
                                <h3 className="font-bold text-lg mb-6">Risk Indicators</h3>
                                <div className="space-y-4">
                                    {[
                                        { label: 'Gambling Activity', key: 'gambling_lottery_spend_velocity', inverse: true },
                                        { label: 'Luxury Spending', key: 'luxury_spend_velocity', inverse: true },
                                        { label: 'Lending App Usage', key: 'lending_app_velocity', inverse: true },
                                        { label: 'Recreation Spending', key: 'recreation_spend_velocity', inverse: true },
                                    ].map((item) => {
                                        const val = profileData.trends[item.key] || 0
                                        const isHighRisk = item.inverse ? val > 20 : val < -20
                                        return (
                                            <div key={item.key} className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-8 rounded-full ${isHighRisk ? 'bg-red-500' : 'bg-green-500'}`} />
                                                    <span className="font-medium">{item.label}</span>
                                                </div>
                                                <div className={`font-bold ${getVelocityColor(val, item.inverse)}`}>
                                                    {formatVelocity(val)}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Income Indicators */}
                            <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-200">
                                <h3 className="font-bold text-lg mb-6">Income Profile</h3>
                                <div className="space-y-4">
                                    {[
                                        { label: 'Gig Income', key: 'gig_income_velocity', total: profileData.totals.gig_income_inr },
                                        { label: 'Salary Income', key: 'salary_income_velocity', total: profileData.totals.salary_income_inr },
                                    ].map((item) => {
                                        const val = profileData.trends[item.key] || 0
                                        const isGigHeavy = profileData.gig_worker_score > 0.4
                                        return (
                                            <div key={item.key} className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-8 rounded-full ${item.key === 'gig_income_velocity' ? (isGigHeavy ? 'bg-blue-500' : 'bg-cyan-500') : 'bg-cyan-500'}`} />
                                                    <span className="font-medium">{item.label}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-zinc-900">{formatCurrency(item.total)}</div>
                                                    <div className={`text-sm ${getVelocityColor(val)}`}>{formatVelocity(val)}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
