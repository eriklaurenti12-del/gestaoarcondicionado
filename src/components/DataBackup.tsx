import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, FileJson, FileSpreadsheet, Shield, Database, Users, Calendar, Package, DollarSign, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';

const fetchAllData = async () => {
  const [clients, products, appointments, sales, suppliers, installments, financialRecords] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('products').select('*'),
    supabase.from('appointments').select('*, clients(name), products(name)'),
    supabase.from('sales').select('*, clients(name), products(name)'),
    supabase.from('suppliers').select('*'),
    supabase.from('installments').select('*'),
    supabase.from('financial_records').select('*')
  ]);

  return {
    clients: clients.data || [],
    products: products.data || [],
    appointments: appointments.data || [],
    sales: sales.data || [],
    suppliers: suppliers.data || [],
    installments: installments.data || [],
    financialRecords: financialRecords.data || []
  };
};

interface DataBackupProps {
  className?: string;
}

const DataBackup: React.FC<DataBackupProps> = ({ className }) => {
  const { toast } = useToast();
  const [selectedTables, setSelectedTables] = useState<string[]>([
    'clients', 'products', 'appointments', 'sales', 'suppliers', 'installments', 'financialRecords'
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['backup-data'],
    queryFn: fetchAllData,
    enabled: false
  });

  const tables = [
    { key: 'clients', label: 'Clientes', icon: Users, count: data?.clients?.length || 0 },
    { key: 'products', label: 'Serviços/Produtos', icon: Package, count: data?.products?.length || 0 },
    { key: 'appointments', label: 'Agendamentos', icon: Calendar, count: data?.appointments?.length || 0 },
    { key: 'sales', label: 'Vendas', icon: DollarSign, count: data?.sales?.length || 0 },
    { key: 'suppliers', label: 'Fornecedores', icon: Package, count: data?.suppliers?.length || 0 },
    { key: 'installments', label: 'Parcelas', icon: DollarSign, count: data?.installments?.length || 0 },
    { key: 'financialRecords', label: 'Registros Financeiros', icon: DollarSign, count: data?.financialRecords?.length || 0 },
  ];

  const toggleTable = (tableKey: string) => {
    setSelectedTables(prev => 
      prev.includes(tableKey) 
        ? prev.filter(t => t !== tableKey)
        : [...prev, tableKey]
    );
  };

  const selectAll = () => {
    setSelectedTables(tables.map(t => t.key));
  };

  const deselectAll = () => {
    setSelectedTables([]);
  };

  const exportToJSON = async () => {
    setIsExporting(true);
    setExportProgress(10);

    try {
      const result = await refetch();
      setExportProgress(50);

      if (!result.data) throw new Error('No data to export');

      const exportData: Record<string, any> = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        data: {}
      };

      selectedTables.forEach(table => {
        if (result.data[table as keyof typeof result.data]) {
          exportData.data[table] = result.data[table as keyof typeof result.data];
        }
      });

      setExportProgress(80);

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-salao-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      toast({ title: "Backup realizado!", description: "Arquivo JSON exportado com sucesso." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no backup", description: error.message });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    setExportProgress(10);

    try {
      const result = await refetch();
      setExportProgress(30);

      if (!result.data) throw new Error('No data to export');

      const totalTables = selectedTables.length;
      let processed = 0;

      for (const tableKey of selectedTables) {
        const tableData = result.data[tableKey as keyof typeof result.data];
        if (!tableData || tableData.length === 0) continue;

        // Convert to CSV
        const headers = Object.keys(tableData[0]).filter(h => 
          typeof tableData[0][h] !== 'object' || tableData[0][h] === null
        );
        
        const csvRows = [headers.join(',')];
        
        tableData.forEach((row: any) => {
          const values = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') {
              value = value.replace(/"/g, '""');
              if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value}"`;
              }
            }
            return value;
          });
          csvRows.push(values.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableKey}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        processed++;
        setExportProgress(30 + (processed / totalTables) * 70);
      }

      toast({ title: "Backup realizado!", description: `${selectedTables.length} arquivo(s) CSV exportado(s).` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no backup", description: error.message });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Backup Seguro</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Seus dados são exportados diretamente do banco de dados. Mantenha o backup em local seguro.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Selecionar Dados
            </CardTitle>
            <CardDescription>
              Escolha quais tabelas você deseja exportar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Selecionar Tudo
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Limpar Seleção
              </Button>
            </div>

            <div className="space-y-3">
              {tables.map(table => {
                const Icon = table.icon;
                const isSelected = selectedTables.includes(table.key);
                
                return (
                  <div
                    key={table.key}
                    onClick={() => toggleTable(table.key)}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                      ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
                    `}
                  >
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => toggleTable(table.key)}
                    />
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1">
                      <Label className="cursor-pointer font-medium">{table.label}</Label>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {table.count} registro(s)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Exportar Backup
            </CardTitle>
            <CardDescription>
              Escolha o formato de exportação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isExporting && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Exportando...</span>
                  <span>{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}

            <div className="grid gap-4">
              {/* JSON Export */}
              <Card className="border-2 hover:border-primary/50 transition-all cursor-pointer" onClick={exportToJSON}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900">
                      <FileJson className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Exportar JSON</h4>
                      <p className="text-sm text-muted-foreground">
                        Todos os dados em um único arquivo estruturado
                      </p>
                    </div>
                    <Button 
                      disabled={isExporting || selectedTables.length === 0}
                      onClick={(e) => { e.stopPropagation(); exportToJSON(); }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* CSV Export */}
              <Card className="border-2 hover:border-primary/50 transition-all cursor-pointer" onClick={exportToCSV}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                      <FileSpreadsheet className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Exportar CSV/Excel</h4>
                      <p className="text-sm text-muted-foreground">
                        Um arquivo por tabela, compatível com Excel
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      disabled={isExporting || selectedTables.length === 0}
                      onClick={(e) => { e.stopPropagation(); exportToCSV(); }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Info */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <h5 className="font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Dicas de Backup
              </h5>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Faça backup regularmente (semanal recomendado)</li>
                <li>• Guarde em local seguro (Google Drive, HD externo)</li>
                <li>• O formato JSON preserva todos os dados originais</li>
                <li>• CSV é ideal para visualização no Excel</li>
              </ul>
            </div>

            {selectedTables.length === 0 && (
              <Alert variant="destructive">
                <AlertTitle>Nenhuma tabela selecionada</AlertTitle>
                <AlertDescription>
                  Selecione pelo menos uma tabela para exportar.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataBackup;
