import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, FileJson, FileSpreadsheet, FileArchive, Shield, Database, Users, Calendar, Package, DollarSign, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';
import JSZip from 'jszip';

const fetchAllData = async () => {
  const [clients, products, appointments, sales, suppliers, installments, financialRecords] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('products').select('*'),
    supabase.from('appointments').select('*'),
    supabase.from('sales').select('*'),
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedTables, setSelectedTables] = useState<string[]>([
    'clients', 'products', 'appointments', 'sales', 'suppliers', 'installments', 'financialRecords'
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [importPreview, setImportPreview] = useState<any>(null);

  const { data, refetch } = useQuery({
    queryKey: ['backup-data'],
    queryFn: fetchAllData,
    enabled: false
  });

  const tables = [
    { key: 'clients', label: 'Clientes', icon: Users, dbTable: 'clients' },
    { key: 'products', label: 'Serviços/Produtos', icon: Package, dbTable: 'products' },
    { key: 'appointments', label: 'Agendamentos', icon: Calendar, dbTable: 'appointments' },
    { key: 'sales', label: 'Vendas', icon: DollarSign, dbTable: 'sales' },
    { key: 'suppliers', label: 'Fornecedores', icon: Package, dbTable: 'suppliers' },
    { key: 'installments', label: 'Parcelas', icon: DollarSign, dbTable: 'installments' },
    { key: 'financialRecords', label: 'Registros Financeiros', icon: DollarSign, dbTable: 'financial_records' },
  ];

  const toggleTable = (tableKey: string) => {
    setSelectedTables(prev => 
      prev.includes(tableKey) ? prev.filter(t => t !== tableKey) : [...prev, tableKey]
    );
  };

  const selectAll = () => setSelectedTables(tables.map(t => t.key));
  const deselectAll = () => setSelectedTables([]);

  // Export Functions
  const exportToJSON = async () => {
    setIsExporting(true);
    setExportProgress(10);
    try {
      const result = await refetch();
      setExportProgress(50);
      if (!result.data) throw new Error('No data to export');

      const exportData: Record<string, any> = {
        exportDate: new Date().toISOString(),
        version: '2.0',
        appName: 'Salao de Beleza',
        data: {}
      };

      selectedTables.forEach(table => {
        if (result.data[table as keyof typeof result.data]) {
          exportData.data[table] = result.data[table as keyof typeof result.data];
        }
      });

      setExportProgress(80);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      downloadFile(blob, `backup-salao-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`);
      setExportProgress(100);
      toast({ title: "Backup realizado!", description: "Arquivo JSON exportado com sucesso." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no backup", description: error.message });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  const exportToZIP = async () => {
    setIsExporting(true);
    setExportProgress(10);
    try {
      const result = await refetch();
      setExportProgress(30);
      if (!result.data) throw new Error('No data to export');

      const zip = new JSZip();
      const backupFolder = zip.folder('backup-salao');
      
      // Add metadata
      const metadata = {
        exportDate: new Date().toISOString(),
        version: '2.0',
        appName: 'Salao de Beleza',
        tables: selectedTables
      };
      backupFolder?.file('_metadata.json', JSON.stringify(metadata, null, 2));
      
      setExportProgress(50);
      
      // Add each table as separate JSON file
      selectedTables.forEach(tableKey => {
        const tableData = result.data[tableKey as keyof typeof result.data];
        if (tableData && tableData.length > 0) {
          backupFolder?.file(`${tableKey}.json`, JSON.stringify(tableData, null, 2));
        }
      });

      setExportProgress(80);
      const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      downloadFile(content, `backup-salao-${format(new Date(), 'yyyy-MM-dd-HHmm')}.zip`);
      setExportProgress(100);
      toast({ title: "Backup realizado!", description: "Arquivo ZIP exportado com sucesso." });
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

      const zip = new JSZip();
      const csvFolder = zip.folder('backup-csv');
      
      selectedTables.forEach(tableKey => {
        const tableData = result.data[tableKey as keyof typeof result.data];
        if (!tableData || tableData.length === 0) return;

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

        csvFolder?.file(`${tableKey}.csv`, '\ufeff' + csvRows.join('\n'));
      });

      setExportProgress(80);
      const content = await zip.generateAsync({ type: 'blob' });
      downloadFile(content, `backup-csv-${format(new Date(), 'yyyy-MM-dd')}.zip`);
      toast({ title: "Backup realizado!", description: "Arquivos CSV exportados em ZIP." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro no backup", description: error.message });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(0), 1000);
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import Functions
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        
        if (!parsed.data || !parsed.version) {
          throw new Error('Arquivo de backup inválido');
        }
        
        setImportPreview({
          type: 'json',
          filename: file.name,
          date: parsed.exportDate,
          version: parsed.version,
          tables: Object.keys(parsed.data).map(key => ({
            key,
            count: Array.isArray(parsed.data[key]) ? parsed.data[key].length : 0
          })),
          rawData: parsed.data
        });
      } else if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const folder = zip.folder('backup-salao');
        
        if (!folder) throw new Error('Estrutura de backup inválida');
        
        const metadataFile = folder.file('_metadata.json');
        let metadata = null;
        
        if (metadataFile) {
          const metaText = await metadataFile.async('text');
          metadata = JSON.parse(metaText);
        }
        
        const tablesList: any[] = [];
        const rawData: Record<string, any[]> = {};
        
        for (const [relativePath, zipEntry] of Object.entries(folder.files)) {
          if (relativePath.endsWith('.json') && !relativePath.includes('_metadata')) {
            const content = await (zipEntry as JSZip.JSZipObject).async('text');
            const tableKey = relativePath.replace('backup-salao/', '').replace('.json', '');
            const tableData = JSON.parse(content);
            rawData[tableKey] = tableData;
            tablesList.push({ key: tableKey, count: tableData.length });
          }
        }
        
        setImportPreview({
          type: 'zip',
          filename: file.name,
          date: metadata?.exportDate,
          version: metadata?.version,
          tables: tablesList,
          rawData
        });
      } else {
        throw new Error('Formato de arquivo não suportado. Use .json ou .zip');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao ler arquivo", description: error.message });
      setImportPreview(null);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async () => {
    if (!importPreview?.rawData) return;
    
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO: Esta ação irá SUBSTITUIR os dados existentes pelas informações do backup.\n\n' +
      'Dados atuais serão perdidos. Deseja continuar?'
    );
    
    if (!confirmed) return;
    
    setIsImporting(true);
    setImportProgress(0);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');
      
      const userId = session.user.id;
      const totalTables = Object.keys(importPreview.rawData).length;
      let processed = 0;
      
      // Import order matters due to foreign keys
      const importOrder = ['suppliers', 'clients', 'products', 'appointments', 'sales', 'installments', 'financialRecords'];
      
      for (const tableKey of importOrder) {
        if (!importPreview.rawData[tableKey]) continue;
        
        const tableConfig = tables.find(t => t.key === tableKey);
        if (!tableConfig) continue;
        
        const tableData = importPreview.rawData[tableKey];
        if (!Array.isArray(tableData) || tableData.length === 0) continue;
        
        // Delete existing data based on table
        const dbTable = tableConfig.dbTable as 'clients' | 'products' | 'appointments' | 'sales' | 'suppliers' | 'installments' | 'financial_records';
        await supabase.from(dbTable).delete().eq('user_id', userId);
        
        // Prepare data for insert (update user_id, remove id for auto-generation)
        const preparedData = tableData.map((row: any) => {
          const { id, clients, products, ...rest } = row;
          return { ...rest, user_id: userId };
        });
        
        // Insert in batches of 100
        for (let i = 0; i < preparedData.length; i += 100) {
          const batch = preparedData.slice(i, i + 100);
          const { error } = await supabase.from(dbTable).insert(batch as any);
          if (error) console.error(`Error importing ${tableKey}:`, error);
        }
        
        processed++;
        setImportProgress(Math.round((processed / totalTables) * 100));
      }
      
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
      
      toast({ title: "Importação concluída!", description: "Todos os dados foram restaurados com sucesso." });
      setImportPreview(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro na importação", description: error.message });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Backup & Restauração Segura</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Exporte seus dados para backup ou restaure a partir de um arquivo anterior.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar Backup
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importar Backup
          </TabsTrigger>
        </TabsList>

        {/* EXPORT TAB */}
        <TabsContent value="export">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Table Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Selecionar Dados
                </CardTitle>
                <CardDescription>Escolha quais tabelas exportar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Button variant="outline" size="sm" onClick={selectAll}>Selecionar Tudo</Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>Limpar</Button>
                </div>
                <div className="space-y-2">
                  {tables.map(table => {
                    const Icon = table.icon;
                    const isSelected = selectedTables.includes(table.key);
                    return (
                      <div key={table.key} onClick={() => toggleTable(table.key)}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                          ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleTable(table.key)} />
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <Label className="cursor-pointer font-medium flex-1">{table.label}</Label>
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
                  Formato de Exportação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isExporting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Exportando...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <Progress value={exportProgress} className="h-2" />
                  </div>
                )}

                <div className="grid gap-3">
                  <Button onClick={exportToJSON} disabled={isExporting || selectedTables.length === 0}
                    className="w-full justify-start h-auto py-3" variant="outline">
                    <FileJson className="w-5 h-5 mr-3 text-amber-600" />
                    <div className="text-left">
                      <div className="font-semibold">JSON</div>
                      <div className="text-xs text-muted-foreground">Formato padrão para importação</div>
                    </div>
                  </Button>

                  <Button onClick={exportToZIP} disabled={isExporting || selectedTables.length === 0}
                    className="w-full justify-start h-auto py-3" variant="outline">
                    <FileArchive className="w-5 h-5 mr-3 text-purple-600" />
                    <div className="text-left">
                      <div className="font-semibold">ZIP Comprimido</div>
                      <div className="text-xs text-muted-foreground">Arquivos separados compactados</div>
                    </div>
                  </Button>

                  <Button onClick={exportToCSV} disabled={isExporting || selectedTables.length === 0}
                    className="w-full justify-start h-auto py-3" variant="outline">
                    <FileSpreadsheet className="w-5 h-5 mr-3 text-green-600" />
                    <div className="text-left">
                      <div className="font-semibold">CSV/Excel (ZIP)</div>
                      <div className="text-xs text-muted-foreground">Compatível com planilhas</div>
                    </div>
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <h5 className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Dicas
                  </h5>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use JSON ou ZIP para restauração posterior</li>
                    <li>• Faça backup semanal regularmente</li>
                    <li>• Guarde em local seguro (Drive, HD externo)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* IMPORT TAB */}
        <TabsContent value="import">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* File Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Selecionar Arquivo
                </CardTitle>
                <CardDescription>Escolha um arquivo de backup para restaurar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium">Clique para selecionar arquivo</p>
                  <p className="text-sm text-muted-foreground mt-1">Formatos: .json ou .zip</p>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Atenção</AlertTitle>
                  <AlertDescription>
                    A importação substituirá os dados existentes. Faça backup antes de continuar.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Preview & Confirm */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Pré-visualização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isImporting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Importando...</span>
                      <span>{importProgress}%</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                  </div>
                )}

                {importPreview ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Arquivo:</div>
                        <div className="font-medium">{importPreview.filename}</div>
                        <div className="text-muted-foreground">Formato:</div>
                        <div className="font-medium uppercase">{importPreview.type}</div>
                        <div className="text-muted-foreground">Versão:</div>
                        <div className="font-medium">{importPreview.version || 'N/A'}</div>
                        {importPreview.date && (
                          <>
                            <div className="text-muted-foreground">Data do backup:</div>
                            <div className="font-medium">{format(new Date(importPreview.date), 'dd/MM/yyyy HH:mm')}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="font-medium">Dados encontrados:</h5>
                      {importPreview.tables.map((table: any) => (
                        <div key={table.key} className="flex justify-between items-center p-2 rounded bg-muted/30">
                          <span className="capitalize">{table.key}</span>
                          <span className="text-sm text-muted-foreground">{table.count} registro(s)</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setImportPreview(null)} className="flex-1">
                        Cancelar
                      </Button>
                      <Button onClick={executeImport} disabled={isImporting} className="flex-1 bg-green-600 hover:bg-green-700">
                        <Upload className="w-4 h-4 mr-2" />
                        Restaurar Dados
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Database className="w-12 h-12 mb-4 opacity-50" />
                    <p>Selecione um arquivo para visualizar</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataBackup;
