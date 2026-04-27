-- ==========================================
-- ESTRUTURA DO BANCO DE DADOS: APP GO+
-- ==========================================

-- 1. TABELA DE GRUPOS (Multi-Tenant Base)
CREATE TABLE IF NOT EXISTS public.grupos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    diocese TEXT,
    estado TEXT,
    dia_reuniao_oracao TEXT,
    dia_reuniao_nucleo TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TABELA DE MEMBROS (Perfis dos Usuários)
-- Conecta-se opcionalmente ao auth.users do Supabase se o membro tiver login (Coordenadores, etc)
CREATE TABLE IF NOT EXISTS public.membros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- ID do login no Supabase (se tiver)
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    data_nascimento DATE,
    cargo TEXT DEFAULT 'Participante', -- Coordenador, Secretario, Tesoureiro, Coord_Ministerio, Nucleo, Participante
    nivel_formacao TEXT DEFAULT 'Iniciante',
    status TEXT DEFAULT 'Ativo',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TABELA DE REUNIÕES (Atas e Resumos)
CREATE TABLE IF NOT EXISTS public.reunioes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- 'Oração' ou 'Núcleo'
    data_reuniao DATE NOT NULL,
    pregador TEXT,
    dirigente TEXT,
    acolhida TEXT,
    avisos_finais TEXT,
    resumo_pregacao TEXT,
    musicas_links TEXT,
    ata_texto TEXT, -- Exclusivo para tipo 'Núcleo'
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TABELA DE PRESENÇAS (Chamada)
CREATE TABLE IF NOT EXISTS public.presencas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reuniao_id UUID REFERENCES public.reunioes(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES public.membros(id) ON DELETE CASCADE,
    marcado_por_usuario BOOLEAN DEFAULT FALSE, -- True se ele clicou no botão "Estive Lá"
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. TABELA DE EVENTOS (Agenda)
CREATE TABLE IF NOT EXISTS public.eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    descricao TEXT,
    local_evento TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. TABELA FINANCEIRA (Tesouraria Básica)
CREATE TABLE IF NOT EXISTS public.financeiro (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES public.membros(id) ON DELETE SET NULL, -- Para controle de mensalidade dos Servos
    tipo TEXT NOT NULL, -- 'Entrada', 'Saida', 'Mensalidade'
    valor DECIMAL(10,2) NOT NULL,
    descricao TEXT,
    data_registro DATE NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. TABELA DE PEDIDOS DE ORAÇÃO (Privado ao Núcleo)
CREATE TABLE IF NOT EXISTS public.pedidos_oracao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES public.membros(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    lido_pelo_nucleo BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. TABELA DE PARTILHAS (Mural Público do GO)
CREATE TABLE IF NOT EXISTS public.partilhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES public.membros(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS (Segurança) mas deixando aberto temporariamente para o MVP
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_oracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partilhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo no MVP" ON public.grupos FOR ALL USING (true);
CREATE POLICY "Permitir tudo no MVP" ON public.membros FOR ALL USING (true);
CREATE POLICY "Permitir tudo no MVP" ON public.reunioes FOR ALL USING (true);
CREATE POLICY "Permitir tudo no MVP" ON public.presencas FOR ALL USING (true);
CREATE POLICY "Permitir tudo no MVP" ON public.eventos FOR ALL USING (true);
CREATE POLICY "Permitir tudo no MVP" ON public.financeiro FOR ALL USING (true);
CREATE POLICY "Permitir tudo no MVP" ON public.pedidos_oracao FOR ALL USING (true);
CREATE POLICY "Permitir tudo no MVP" ON public.partilhas FOR ALL USING (true);

-- ==============================================================================
-- ATUALIZAÇÕES DA FASE 5: ONBOARDING E NOVOS CAMPOS DO GRUPO
-- ==============================================================================
-- Execute estes comandos abaixo para adicionar as colunas de horário e local 
-- caso a tabela `grupos` já tenha sido criada:

ALTER TABLE grupos ADD COLUMN IF NOT EXISTS hora_reuniao_oracao TIME;
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS hora_reuniao_nucleo TIME;
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS local_link_maps TEXT;

-- ==============================================================================
-- FASE 6: MOTOR GLOBAL DE PERMISSÕES (RBAC E SUPERADMIN)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cargos_permissoes (
    cargo TEXT PRIMARY KEY,
    permissoes JSONB NOT NULL,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.cargos_permissoes ENABLE ROW LEVEL SECURITY;
-- Leitura aberta para os usuários do app
CREATE POLICY "Permitir leitura de permissoes" ON public.cargos_permissoes FOR SELECT USING (true);
-- Atualização restrita (só o superadmin deveria fazer, mas liberado temporariamente pro MVP)
CREATE POLICY "Permitir tudo permissoes MVP" ON public.cargos_permissoes FOR ALL USING (true);

-- Insert dos Padrões da Matriz da RCC
INSERT INTO public.cargos_permissoes (cargo, permissoes) VALUES
('Coordenador', '{"pessoas": "executar", "ata": "executar", "configuracoes": "executar", "metricas": "visualizar", "pedidos": "todos", "eventos": "executar", "partilhas": "executar", "resumo": "executar", "escala": "executar", "tesouraria": "executar"}'),
('Secretário', '{"pessoas": "nenhum", "ata": "executar", "configuracoes": "nenhum", "metricas": "nenhum", "pedidos": "nenhum", "eventos": "executar", "partilhas": "nenhum", "resumo": "nenhum", "escala": "executar", "tesouraria": "nenhum"}'),
('Tesoureiro', '{"pessoas": "nenhum", "ata": "nenhum", "configuracoes": "nenhum", "metricas": "nenhum", "pedidos": "nenhum", "eventos": "nenhum", "partilhas": "nenhum", "resumo": "nenhum", "escala": "nenhum", "tesouraria": "executar"}'),
('Membro do Núcleo', '{"pessoas": "visualizar", "ata": "visualizar", "configuracoes": "visualizar", "metricas": "visualizar", "pedidos": "todos", "eventos": "ver", "partilhas": "executar", "resumo": "executar", "escala": "ver", "tesouraria": "ver"}'),
('Coord. Ministério', '{"pessoas": "executar", "ata": "nenhum", "configuracoes": "nenhum", "metricas": "nenhum", "pedidos": "nenhum", "eventos": "nenhum", "partilhas": "nenhum", "resumo": "nenhum", "escala": "nenhum", "tesouraria": "nenhum"}'),
('Membro de Ministério', '{"pessoas": "visualizar", "ata": "nenhum", "configuracoes": "nenhum", "metricas": "nenhum", "pedidos": "todos", "eventos": "nenhum", "partilhas": "visualizar", "resumo": "visualizar", "escala": "nenhum", "tesouraria": "nenhum"}'),
('Participante', '{"pessoas": "nenhum", "ata": "nenhum", "configuracoes": "nenhum", "metricas": "nenhum", "pedidos": "proprios", "eventos": "ver_publicos", "partilhas": "visualizar", "resumo": "visualizar", "escala": "nenhum", "tesouraria": "nenhum"}')
ON CONFLICT (cargo) DO NOTHING;

-- ==============================================================================
-- FASE 7: PERFIL, CONTAGEM REGRESSIVA INTELIGENTE E ENGAJAMENTO
-- ==============================================================================

-- 1. Novas colunas na tabela de Membros
ALTER TABLE public.membros ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE public.membros ADD COLUMN IF NOT EXISTS indicado_por UUID REFERENCES public.membros(id) ON DELETE SET NULL;

-- 2. Tabela de Intenções de Presença (O botão "Eu vou!")
CREATE TABLE IF NOT EXISTS public.intencoes_presenca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membro_id UUID REFERENCES public.membros(id) ON DELETE CASCADE,
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    data_reuniao DATE NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(membro_id, data_reuniao) -- Garante que a pessoa só clique "eu vou" uma vez por data
);

ALTER TABLE public.intencoes_presenca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo em intencoes MVP" ON public.intencoes_presenca FOR ALL USING (true);

-- 3. Criação do Bucket de Storage para Fotos de Perfil
-- Obs: Alguns projetos não permitem criação de bucket via SQL puro devido a permissões.
-- Caso falhe, o usuário pode criar manualmente no painel do Supabase com o nome 'avatars' e deixá-lo público.
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload público de fotos (MVP)
CREATE POLICY "Avatar Público" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Upload Avatar MVP" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Update Avatar MVP" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

-- ==============================================================================
-- FASE 8: ACONTECEU E TELEFONE (WHATSAPP)
-- ==============================================================================

ALTER TABLE public.membros ADD COLUMN IF NOT EXISTS telefone TEXT;

CREATE TABLE IF NOT EXISTS public.aconteceu_go (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    membro_id UUID REFERENCES public.membros(id) ON DELETE SET NULL,
    texto TEXT NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.aconteceu_go ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura Geral Aconteceu" ON public.aconteceu_go FOR SELECT USING (true);
CREATE POLICY "Insert Aconteceu MVP" ON public.aconteceu_go FOR INSERT WITH CHECK (true);
