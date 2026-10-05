 import React, { useEffect, useState } from 'react';
 import { useAdminMaster } from '@/hooks/useAdminMaster';
 import { Navigate } from 'react-router-dom';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Badge } from '@/components/ui/badge';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
 import { Textarea } from '@/components/ui/textarea';
  import { ArrowLeft, Check, X, Eye, Mail, Phone, Building2, User, Clock, MessageSquare as WhatsAppIcon } from 'lucide-react';
 import { useNavigate } from 'react-router-dom';
 import { toast } from 'sonner';
 import { supabase } from '@/integrations/supabase/client';
 
 const AdminRegistrationRequests = () => {
   const { isAdminMaster, loading: authLoading } = useAdminMaster();
   const navigate = useNavigate();
   const [requests, setRequests] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedRequest, setSelectedRequest] = useState<any>(null);
   const [reviewNotes, setReviewNotes] = useState('');
   const [processing, setProcessing] = useState(false);
 
   const fetchRequests = async () => {
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('registration_requests')
         .select('*')
         .order('created_at', { ascending: false });
       
       if (error) throw error;
       setRequests(data || []);
     } catch (e: any) {
       toast.error('Erro ao carregar solicitações: ' + e.message);
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     if (!isAdminMaster || authLoading) return;
     fetchRequests();
   }, [isAdminMaster, authLoading]);
 
   const handleReview = async (status: 'approved' | 'rejected') => {
     if (!selectedRequest) return;
     setProcessing(true);
     try {
       const { error: updateError } = await supabase
         .from('registration_requests')
         .update({
           status,
           review_notes: reviewNotes,
           reviewed_at: new Date().toISOString(),
           reviewed_by: (await supabase.auth.getUser()).data.user?.id
         })
         .eq('id', selectedRequest.id);
 
       if (updateError) throw updateError;
 
       // Also update profile status
       const { error: profileError } = await supabase
         .from('profiles')
         .update({ approval_status: status })
         .eq('id', selectedRequest.user_id);
 
       if (profileError) throw profileError;
 
       toast.success(`Solicitação ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso`);
       setSelectedRequest(null);
       setReviewNotes('');
       fetchRequests();
     } catch (e: any) {
       toast.error('Erro ao processar solicitação: ' + e.message);
     } finally {
       setProcessing(false);
     }
   };
 
   if (authLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
   if (!isAdminMaster) return <Navigate to="/dashboard" replace />;
 
   return (
     <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
       <div className="flex items-center gap-2">
         <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')}>
           <ArrowLeft className="h-5 w-5" />
         </Button>
         <h1 className="text-xl font-bold text-foreground">Solicitações de Registro</h1>
       </div>
 
       {loading ? <Skeleton className="h-64 w-full" /> : (
         <Card className="border-0 shadow-sm">
           <CardContent className="p-0">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead>Usuário / Empresa</TableHead>
                   <TableHead>Contato</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead>Data</TableHead>
                   <TableHead className="text-right">Ações</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {requests.map(req => (
                   <TableRow key={req.id}>
                     <TableCell>
                       <div>
                         <p className="font-medium text-foreground">{req.full_name}</p>
                         <p className="text-xs text-muted-foreground">{req.company_name}</p>
                       </div>
                     </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3 w-3" /> {req.email}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {req.phone}
                          </div>
                          {req.phone && (
                            <a 
                              href={`https://wa.me/${req.phone.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-green-600 hover:underline font-medium mt-1"
                            >
                              <WhatsAppIcon className="h-3 w-3" /> WhatsApp
                            </a>
                          )}
                        </div>
                      </TableCell>
                     <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant="secondary" 
                            className={
                              req.status === 'approved' ? 'bg-green-100 text-green-700' : 
                              req.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                              'bg-yellow-100 text-yellow-700'
                            }
                          >
                            {req.status === 'pending' ? 'Pendente' : req.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                          </Badge>
                          {req.status === 'pending' && (
                            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium">
                              <Clock className="h-3 w-3" />
                              Analise em 24h
                            </div>
                          )}
                        </div>
                     </TableCell>
                     <TableCell className="text-muted-foreground text-xs">
                       {new Date(req.created_at).toLocaleDateString('pt-BR')}
                     </TableCell>
                     <TableCell className="text-right">
                       <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(req)}>
                         <Eye className="h-4 w-4 mr-1" /> Analisar
                       </Button>
                     </TableCell>
                   </TableRow>
                 ))}
                 {requests.length === 0 && (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                       Nenhuma solicitação encontrada.
                     </TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>
           </CardContent>
         </Card>
       )}
 
       <Dialog open={!!selectedRequest} onOpenChange={() => !processing && setSelectedRequest(null)}>
         <DialogContent className="max-w-2xl">
           <DialogHeader>
             <DialogTitle>Análise de Registro</DialogTitle>
             <DialogDescription>Revise os dados fornecidos pelo usuário para aprovação.</DialogDescription>
           </DialogHeader>
           
           {selectedRequest && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
               <div className="space-y-4">
                 <h4 className="text-sm font-semibold flex items-center gap-2 border-b pb-1">
                   <User className="h-4 w-4" /> Dados Pessoais
                 </h4>
                 <div className="space-y-2">
                   <div>
                     <p className="text-[10px] uppercase text-muted-foreground font-semibold">Nome Completo</p>
                     <p className="text-sm">{selectedRequest.full_name}</p>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase text-muted-foreground font-semibold">E-mail</p>
                     <p className="text-sm">{selectedRequest.email}</p>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase text-muted-foreground font-semibold">Telefone</p>
                     <p className="text-sm">{selectedRequest.phone}</p>
                   </div>
                 </div>
               </div>
 
               <div className="space-y-4">
                 <h4 className="text-sm font-semibold flex items-center gap-2 border-b pb-1">
                   <Building2 className="h-4 w-4" /> Dados do Negócio
                 </h4>
                 <div className="space-y-2">
                   <div>
                     <p className="text-[10px] uppercase text-muted-foreground font-semibold">Empresa</p>
                     <p className="text-sm">{selectedRequest.company_name}</p>
                   </div>
                   <div>
                     <p className="text-[10px] uppercase text-muted-foreground font-semibold">Documento (CPF/CNPJ)</p>
                     <p className="text-sm">{selectedRequest.document}</p>
                   </div>
                 </div>
               </div>
 
               <div className="md:col-span-2 space-y-4 mt-2">
                 <h4 className="text-sm font-semibold flex items-center gap-2 border-b pb-1">
                   <Mail className="h-4 w-4" /> Configurações Solicitadas
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="p-3 rounded-lg bg-muted/50 border">
                     <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">E-mail para Disparos</p>
                     <p className="text-sm font-medium">{selectedRequest.email_marketing_config}</p>
                   </div>
                   <div className="p-3 rounded-lg bg-muted/50 border">
                     <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">WhatsApp Conectado</p>
                     <p className="text-sm font-medium">{selectedRequest.whatsapp_config}</p>
                   </div>
                 </div>
               </div>
 
               <div className="md:col-span-2 space-y-2 pt-2">
                 <p className="text-[10px] uppercase text-muted-foreground font-semibold">Observações Internas (opcional)</p>
                 <Textarea 
                   placeholder="Adicione notas sobre sua decisão..." 
                   value={reviewNotes} 
                   onChange={e => setReviewNotes(e.target.value)}
                   disabled={selectedRequest.status !== 'pending'}
                 />
               </div>
             </div>
           )}
 
           <DialogFooter className="gap-2 sm:gap-0">
             {selectedRequest?.status === 'pending' ? (
               <>
                 <Button 
                   variant="destructive" 
                   className="flex-1 sm:flex-none"
                   onClick={() => handleReview('rejected')}
                   disabled={processing}
                 >
                   <X className="h-4 w-4 mr-2" /> Rejeitar
                 </Button>
                 <Button 
                   variant="default" 
                   className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                   onClick={() => handleReview('approved')}
                   disabled={processing}
                 >
                   <Check className="h-4 w-4 mr-2" /> Aprovar Registro
                 </Button>
               </>
             ) : (
               <Button variant="outline" onClick={() => setSelectedRequest(null)}>Fechar</Button>
             )}
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </div>
   );
 };
 
 export default AdminRegistrationRequests;