import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Mail, Phone, Building2, Camera, Save, Loader2, CreditCard, 
  Shield, Key, Bell, Globe, MapPin, Briefcase,
  LogOut, CheckCircle2, AlertCircle, Eye, EyeOff,
  Instagram, Linkedin, Twitter, Link2, Crown, Sparkles,
  Clock, ImageIcon, ChevronRight, Pencil, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function UserProfilePage() {
  const { user, signOut } = useAuth();
  const { planType, status, isTrialActive, trialDaysRemaining, isFree, monthlyPrice, billingCycle } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', company: '', jobTitle: '',
    location: '', bio: '', address: '', instagram: '', linkedin: '',
    twitter: '', website: '',
  });

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata || {};
      setFormData({
        fullName: meta.full_name || meta.username || '',
        email: user.email || '',
        phone: meta.phone || user.phone || '',
        company: meta.company || '',
        jobTitle: meta.job_title || '',
        location: meta.location || '',
        bio: meta.bio || '',
        address: meta.address || '',
        instagram: meta.instagram || '',
        linkedin: meta.linkedin || '',
        twitter: meta.twitter || '',
        website: meta.website || '',
      });
      const fetchCompany = async () => {
        const { data } = await supabase.from('company_users').select('company_id, companies(name)').eq('user_id', user.id).limit(1).single();
        if (data?.companies) setCompanyName((data.companies as any).name || '');
      };
      fetchCompany();
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: formData.fullName, phone: formData.phone, company: formData.company,
          job_title: formData.jobTitle, location: formData.location, bio: formData.bio,
          address: formData.address, instagram: formData.instagram, linkedin: formData.linkedin,
          twitter: formData.twitter, website: formData.website,
        }
      });
      if (error) throw error;
      toast({ title: 'Perfil atualizado!' });
      setEditing(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.auth.updateUser({ data: { avatar_url: `${publicUrl.publicUrl}?t=${Date.now()}` } });
      toast({ title: 'Foto atualizada!' });
      window.location.reload();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/cover.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('covers').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from('covers').getPublicUrl(filePath);
      await supabase.auth.updateUser({ data: { cover_url: `${publicUrl.publicUrl}?t=${Date.now()}` } });
      toast({ title: 'Capa atualizada!' });
      window.location.reload();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const daysActive = createdAt ? differenceInDays(new Date(), createdAt) : 0;
  const memberSince = createdAt ? format(createdAt, "MMM yyyy", { locale: ptBR }) : '';
  const lastSignIn = user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
  const initials = formData.fullName ? formData.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US';
  const coverUrl = user?.user_metadata?.cover_url;
  const planLabel = isFree ? 'Free' : planType === 'business' ? 'Business' : planType.charAt(0).toUpperCase() + planType.slice(1);
  const statusLabel = isFree ? 'Gratuito' : isTrialActive ? `Trial (${trialDaysRemaining}d)` : status === 'active' ? 'Ativo' : status;

  const socialLinks = [
    { icon: Instagram, label: 'Instagram', value: formData.instagram },
    { icon: Linkedin, label: 'LinkedIn', value: formData.linkedin },
    { icon: Twitter, label: 'X (Twitter)', value: formData.twitter },
    { icon: Globe, label: 'Website', value: formData.website },
  ].filter(s => s.value);

  const profileActions = [
    { icon: Pencil, label: 'Editar Perfil', desc: 'Alterar nome, bio, foto e dados pessoais', action: () => setEditing(true), color: '#374DA4' },
    { icon: Shield, label: 'Segurança', desc: 'Alterar senha e sessões ativas', action: () => navigate('/dashboard/seguranca'), color: '#374DA4' },
    { icon: Bell, label: 'Notificações', desc: 'Preferências de alertas e push', action: () => navigate('/dashboard/configuracoes/notificacoes'), color: '#F59E0B' },
    { icon: CreditCard, label: 'Minha Assinatura', desc: 'Gerenciar plano e pagamentos', action: () => navigate(isFree ? '/checkout/ativar' : '/dashboard/minhassinatura'), color: '#10B981' },
  ];

  return (
    <div className="min-h-full bg-background pb-24 md:pb-8">
      {/* Cover - edge to edge */}
      <div className="relative w-full">
        <div 
          className="h-44 sm:h-56 w-full bg-gradient-to-br from-primary/80 via-primary/60 to-primary/40 relative overflow-hidden"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {!coverUrl && (
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          )}
          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-medium transition-colors backdrop-blur-sm"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Editar capa
          </button>
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </div>

        {/* Avatar overlapping cover */}
        <div className="max-w-3xl mx-auto px-5 -mt-14 relative z-10">
          <div className="flex items-end gap-4">
            <div className="relative flex-shrink-0">
              <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-muted text-foreground text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 w-8 h-8 flex items-center justify-center bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer hover:bg-primary/90 transition-colors border-2 border-background"
              >
                <Camera className="h-3.5 w-3.5" />
              </label>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5">
        {/* Name & Info */}
        <div className="mt-3">
          <h1 className="text-xl font-bold text-foreground">{formData.fullName || 'Seu Nome'}</h1>
          <p className="text-sm text-muted-foreground">{formData.email}</p>
          {formData.bio && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{formData.bio}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {companyName && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg px-2.5 py-1">
                <Building2 className="h-3 w-3" /> {companyName}
              </span>
            )}
            {formData.jobTitle && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg px-2.5 py-1">
                <Briefcase className="h-3 w-3" /> {formData.jobTitle}
              </span>
            )}
            {formData.location && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg px-2.5 py-1">
                <MapPin className="h-3 w-3" /> {formData.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-lg px-2.5 py-1">
              <Clock className="h-3 w-3" /> {daysActive}d ativo · Desde {memberSince}
            </span>
          </div>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.value.startsWith('http') ? s.value : `https://${s.value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted-foreground/15 transition-colors"
                  title={s.label}
                >
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Plan Card */}
        <div className="mt-5">
          <div className="rounded-2xl bg-card border border-border/60 p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                {isFree ? <Sparkles className="h-5 w-5 text-primary" /> : <Crown className="h-5 w-5 text-primary" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Plano {planLabel}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{statusLabel}</span>
                </div>
                {!isFree && monthlyPrice > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">R$ {monthlyPrice.toFixed(2)}/{billingCycle === 'yearly' ? 'ano' : 'mês'}</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(isFree ? '/checkout/ativar' : '/dashboard/minhassinatura')}
              className="gap-1.5 rounded-xl text-xs"
            >
              {isFree ? <><Sparkles className="h-3.5 w-3.5" /> Ativar Business</> : 'Gerenciar'}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5">
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden divide-y divide-border/30">
            {profileActions.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted/60 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: item.color + '14' }}>
                  <item.icon className="h-[18px] w-[18px]" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Session info */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-foreground">Sessão ativa</p>
                <p className="text-[11px] text-muted-foreground">
                  {lastSignIn ? `Último login: ${lastSignIn}` : 'Ativa agora'} · {user?.app_metadata?.provider === 'google' ? 'Google' : 'Email'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 rounded-lg" onClick={() => signOut()}>
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Profile Overlay */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-6">
            {/* Edit Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button onClick={() => setEditing(false)} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
                <h2 className="text-lg font-bold text-foreground">Editar Perfil</h2>
              </div>
              <Button onClick={handleSave} disabled={isLoading} size="sm" className="gap-1.5 rounded-xl">
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>

            <div className="space-y-5">
              {/* Personal Info */}
              <section className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações Pessoais</h3>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <FieldInput icon={User} label="Nome Completo" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Seu nome completo" />
                  <FieldInput icon={Mail} label="Email" name="email" value={formData.email} onChange={() => {}} placeholder="" disabled />
                  <FieldInput icon={Phone} label="Telefone" name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
                  <FieldInput icon={MapPin} label="Localização" name="location" value={formData.location} onChange={handleChange} placeholder="Cidade, Estado" />
                  <div className="sm:col-span-2">
                    <FieldInput icon={MapPin} label="Endereço" name="address" value={formData.address} onChange={handleChange} placeholder="Rua, Nº, Bairro, CEP" />
                  </div>
                </div>
              </section>

              {/* Professional */}
              <section className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profissional</h3>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <FieldInput icon={Building2} label="Empresa" name="company" value={formData.company} onChange={handleChange} placeholder={companyName || 'Empresa'} />
                  <FieldInput icon={Briefcase} label="Cargo" name="jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="Ex: Diretor de Marketing" />
                </div>
              </section>

              {/* Bio */}
              <section className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bio</h3>
                <textarea
                  name="bio" value={formData.bio} onChange={handleChange}
                  placeholder="Conte um pouco sobre você..."
                  rows={3}
                  className="flex w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </section>

              {/* Social */}
              <section className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Redes Sociais</h3>
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <FieldInput icon={Instagram} label="Instagram" name="instagram" value={formData.instagram} onChange={handleChange} placeholder="@seuusuario" />
                  <FieldInput icon={Linkedin} label="LinkedIn" name="linkedin" value={formData.linkedin} onChange={handleChange} placeholder="linkedin.com/in/seuperfil" />
                  <FieldInput icon={Twitter} label="X (Twitter)" name="twitter" value={formData.twitter} onChange={handleChange} placeholder="@seuusuario" />
                  <FieldInput icon={Globe} label="Website" name="website" value={formData.website} onChange={handleChange} placeholder="https://seusite.com" />
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInput({ icon: Icon, label, name, value, onChange, placeholder, disabled }: {
  icon: any; label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          id={name} name={name} value={value} onChange={onChange}
          placeholder={placeholder} disabled={disabled}
          className={`pl-9 rounded-xl h-9 text-sm ${disabled ? 'bg-muted' : ''}`}
        />
      </div>
    </div>
  );
}

export default UserProfilePage;
