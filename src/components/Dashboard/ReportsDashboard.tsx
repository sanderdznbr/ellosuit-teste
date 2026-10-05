import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Calendar, BarChart3, PieChart, TrendingUp, Clock, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Report {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  status: 'ready' | 'generating' | 'scheduled';
  format: string;
}

const ReportsDashboard = () => {
  const { toast } = useToast();
  const [reportType, setReportType] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      type: 'engagement',
      title: 'Relatório de Engajamento - Janeiro 2025',
      createdAt: new Date().toISOString(),
      status: 'ready',
      format: 'PDF',
    },
    {
      id: '2',
      type: 'traffic',
      title: 'Análise de Tráfego Semanal',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      status: 'ready',
      format: 'PDF',
    },
    {
      id: '3',
      type: 'conversion',
      title: 'Relatório de Conversões Q4',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      status: 'generating',
      format: 'Excel',
    },
  ]);

  const reportTypes = [
    { value: 'engagement', label: 'Engajamento', icon: TrendingUp },
    { value: 'traffic', label: 'Tráfego', icon: BarChart3 },
    { value: 'conversion', label: 'Conversões', icon: PieChart },
    { value: 'documents', label: 'Documentos', icon: FileText },
  ];

  const dateRanges = [
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Última Semana' },
    { value: 'month', label: 'Último Mês' },
    { value: 'quarter', label: 'Último Trimestre' },
    { value: 'year', label: 'Último Ano' },
    { value: 'custom', label: 'Personalizado' },
  ];

  const handleGenerateReport = () => {
    if (!reportType || !dateRange) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione o tipo de relatório e período',
        variant: 'destructive',
      });
      return;
    }

    const newReport: Report = {
      id: Math.random().toString(36).substring(7),
      type: reportType,
      title: `${reportTypes.find(r => r.value === reportType)?.label} - ${dateRanges.find(d => d.value === dateRange)?.label}`,
      createdAt: new Date().toISOString(),
      status: 'generating',
      format: 'PDF',
    };

    setReports([newReport, ...reports]);
    toast({
      title: 'Gerando relatório',
      description: 'Seu relatório está sendo gerado. Aguarde alguns instantes.',
    });

    // Simulate report generation
    setTimeout(() => {
      setReports(prev => prev.map(r => 
        r.id === newReport.id ? { ...r, status: 'ready' as const } : r
      ));
      toast({
        title: 'Relatório pronto!',
        description: 'Seu relatório foi gerado com sucesso.',
      });
    }, 3000);
  };

  const handleDownload = (report: Report) => {
    toast({
      title: 'Baixando...',
      description: `${report.title}.${report.format.toLowerCase()}`,
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      ready: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      generating: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      scheduled: 'bg-[#DFE4FB] text-[#253573] dark:bg-[#0F1631] dark:text-[#879CE0]',
    };
    const labels = {
      ready: 'Pronto',
      generating: 'Gerando...',
      scheduled: 'Agendado',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="page-content p-4 md:p-6 space-y-6 bg-muted/30 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Gere e baixe relatórios detalhados</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-none shadow-md rounded-xl bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{reports.length}</p>
                <p className="text-xs text-muted-foreground">Relatórios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md rounded-xl bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Download className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{reports.filter(r => r.status === 'ready').length}</p>
                <p className="text-xs text-muted-foreground">Prontos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md rounded-xl bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{reports.filter(r => r.status === 'generating').length}</p>
                <p className="text-xs text-muted-foreground">Em Geração</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-md rounded-xl bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#374DA4]/10">
                <Calendar className="h-5 w-5 text-[#374DA4]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Agendados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generate Report */}
        <Card className="border-none shadow-lg rounded-2xl bg-card">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Gerar Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0 space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {dateRanges.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerateReport} className="w-full h-11">
              <FileText className="h-4 w-4 mr-2" />
              Gerar Relatório
            </Button>
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card className="border-none shadow-lg rounded-2xl bg-card lg:col-span-2">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Seus Relatórios ({reports.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reports.map((report) => (
                <div key={report.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{report.title}</p>
                        {getStatusBadge(report.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(report.createdAt).toLocaleDateString()} • {report.format}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={report.status !== 'ready'}
                      onClick={() => handleDownload(report)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsDashboard;
