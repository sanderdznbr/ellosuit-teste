import React, { useState } from 'react';
import { FileText, Link2, Video } from 'lucide-react';
import DocumentTrackingDashboard from '@/components/DocumentTracking/DocumentTrackingDashboard';
import LinkTrackingDashboard from './LinkTrackingDashboard';
import VideoTrackingDashboard from './VideoTrackingDashboard';

type TabValue = 'documentos' | 'links' | 'videos';

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { value: 'documentos', label: 'Documentos PDF', icon: FileText },
  { value: 'links', label: 'Links', icon: Link2 },
  { value: 'videos', label: 'Vídeos', icon: Video },
];

const UnifiedTracking: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabValue>('documentos');

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rastreamento</h1>
          <p className="text-sm text-gray-500">Acompanhe o engajamento com seus conteúdos</p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'documentos' && <DocumentTrackingDashboard />}
        {activeTab === 'links' && <LinkTrackingDashboard />}
        {activeTab === 'videos' && <VideoTrackingDashboard />}
      </div>
    </div>
  );
};

export default UnifiedTracking;
