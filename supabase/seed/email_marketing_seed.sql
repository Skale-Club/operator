-- Email Marketing Seed
-- Usage: psql $DATABASE_URL -f supabase/seed/email_marketing_seed.sql
-- Targets the first organization found in the database.

DO $$
DECLARE
  v_org_id  uuid;
  v_hdr_id  uuid;
  v_ftr_id  uuid;
  v_soc_id  uuid;
  v_tpl_id  uuid;
BEGIN
  -- Resolve org
  SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Create one first.';
  END IF;

  RAISE NOTICE 'Seeding email marketing for org %', v_org_id;

  -- ── 1. Shared sections ───────────────────────────────────────────────────────

  -- Header
  INSERT INTO public.email_sections (org_id, name, type, is_global, html_content) VALUES (
    v_org_id,
    'Header — Xphere',
    'header',
    true,
    $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="background-color:#0f172a;padding:20px 32px;text-align:center;">
      <a href="https://xphere.skale.club" style="text-decoration:none;">
        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:-0.5px;">
          Xphere
        </span>
      </a>
    </td>
  </tr>
</table>
    $html$
  ) RETURNING id INTO v_hdr_id;

  -- Footer
  INSERT INTO public.email_sections (org_id, name, type, is_global, html_content) VALUES (
    v_org_id,
    'Footer — Legal & Unsubscribe',
    'footer',
    true,
    $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;">
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;margin:0 0 8px;">
        Você está recebendo este email porque se cadastrou no <strong>Xphere</strong>.<br />
        {{company_address}}
      </p>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;margin:0;">
        <a href="{{unsubscribe_url}}" style="color:#64748b;text-decoration:underline;">Cancelar inscrição</a>
        &nbsp;·&nbsp;
        <a href="https://xphere.skale.club/privacy" style="color:#64748b;text-decoration:underline;">Política de privacidade</a>
      </p>
    </td>
  </tr>
</table>
    $html$
  ) RETURNING id INTO v_ftr_id;

  -- Social
  INSERT INTO public.email_sections (org_id, name, type, is_global, html_content) VALUES (
    v_org_id,
    'Social Links',
    'social',
    true,
    $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:16px 32px;text-align:center;background-color:#f8fafc;">
      <a href="#" style="display:inline-block;margin:0 8px;font-family:sans-serif;font-size:13px;color:#475569;text-decoration:none;font-weight:500;">LinkedIn</a>
      <a href="#" style="display:inline-block;margin:0 8px;font-family:sans-serif;font-size:13px;color:#475569;text-decoration:none;font-weight:500;">Instagram</a>
      <a href="#" style="display:inline-block;margin:0 8px;font-family:sans-serif;font-size:13px;color:#475569;text-decoration:none;font-weight:500;">Twitter/X</a>
    </td>
  </tr>
</table>
    $html$
  ) RETURNING id INTO v_soc_id;

  -- ── 2. Template: Welcome ─────────────────────────────────────────────────────

  INSERT INTO public.email_templates (org_id, name, subject_line, preview_text, status, tags)
  VALUES (
    v_org_id,
    'Welcome — New User Onboarding',
    'Bem-vindo ao Xphere! Veja por onde começar 🚀',
    'Tudo pronto para você. Explore integrações, automações e muito mais — leva só 5 minutos.',
    'ready',
    ARRAY['onboarding', 'welcome', 'transacional']
  ) RETURNING id INTO v_tpl_id;

  -- Header (referência à seção global)
  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_hdr_id, 'header', 'Header Xphere', '', 0);

  -- Hero
  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'hero', 'Hero — Welcome', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:48px 32px 32px;text-align:center;">
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:32px;font-weight:700;color:#0f172a;margin:0 0 12px;line-height:1.2;">
        Bem-vindo ao Xphere!
      </h1>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.6;color:#475569;margin:0 0 32px;max-width:480px;display:inline-block;">
        Sua conta está pronta. Em poucos minutos você pode conectar seu CRM, criar automações e centralizar tudo em um só lugar.
      </p>
      <a href="https://xphere.skale.club" style="display:inline-block;background-color:#6366f1;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
        Acessar minha conta →
      </a>
    </td>
  </tr>
</table>
  $html$, 1);

  -- Feature highlights
  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'text', 'Features — 3 destaques', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:32px;background-color:#f8fafc;">
      <h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:600;color:#0f172a;margin:0 0 20px;text-align:center;">
        O que você pode fazer agora
      </h2>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
        <tr>
          <td style="padding:12px;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;vertical-align:top;width:30%;">
            <p style="font-family:sans-serif;font-size:24px;margin:0 0 8px;">🤖</p>
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:#0f172a;margin:0 0 4px;">Agentes de IA</p>
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#64748b;margin:0;line-height:1.5;">Crie assistentes que automatizam atendimento 24/7.</p>
          </td>
          <td style="width:16px;"></td>
          <td style="padding:12px;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;vertical-align:top;width:30%;">
            <p style="font-family:sans-serif;font-size:24px;margin:0 0 8px;">📞</p>
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:#0f172a;margin:0 0 4px;">Calls & CRM</p>
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#64748b;margin:0;line-height:1.5;">Gerencie ligações e contatos em um só painel.</p>
          </td>
          <td style="width:16px;"></td>
          <td style="padding:12px;background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;vertical-align:top;width:30%;">
            <p style="font-family:sans-serif;font-size:24px;margin:0 0 8px;">⚡</p>
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:#0f172a;margin:0 0 4px;">Automações</p>
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#64748b;margin:0;line-height:1.5;">Workflows sem código que rodam sozinhos.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  $html$, 2);

  -- Social (referência)
  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_soc_id, 'social', 'Social Links', '', 3);

  -- Footer (referência)
  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_ftr_id, 'footer', 'Footer Legal', '', 4);

  -- ── 3. Template: Newsletter mensal ───────────────────────────────────────────

  INSERT INTO public.email_templates (org_id, name, subject_line, preview_text, status, tags)
  VALUES (
    v_org_id,
    'Newsletter — Atualização Mensal',
    '[Xphere] Novidades de {{mes}} que você precisa ver',
    'Novas funcionalidades, cases de sucesso e dicas práticas para tirar mais proveito da plataforma.',
    'draft',
    ARRAY['newsletter', 'produto', 'mensal']
  ) RETURNING id INTO v_tpl_id;

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_hdr_id, 'header', 'Header Xphere', '', 0);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'hero', 'Hero — Newsletter', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:40px 32px 24px;background-color:#0f172a;">
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Edição de {{mes}} {{ano}}</p>
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:28px;font-weight:700;color:#f8fafc;margin:0 0 16px;line-height:1.3;">
        O que há de novo no Xphere este mês
      </h1>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.6;color:#94a3b8;margin:0;">
        Novidades, melhorias e histórias dos nossos clientes.
      </p>
    </td>
  </tr>
</table>
  $html$, 1);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'text', 'Artigo principal', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:32px;">
      <img src="https://placehold.co/536x240/6366f1/ffffff?text=Feature+Destaque" alt="Feature em destaque" width="536" height="240" style="display:block;width:100%;border-radius:8px;margin-bottom:20px;" />
      <h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;font-weight:600;color:#0f172a;margin:0 0 12px;">
        📣 Novo: {{titulo_feature}}
      </h2>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.7;color:#475569;margin:0 0 16px;">
        {{descricao_feature}}. Esta funcionalidade foi construída com base no feedback de centenas de usuários e resolve o problema de {{problema_resolvido}}.
      </p>
      <a href="#" style="display:inline-block;color:#6366f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">
        Saiba mais →
      </a>
    </td>
  </tr>
</table>
  $html$, 2);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'divider', 'Divisor', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" /></td></tr>
</table>
  $html$, 3);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'text', 'Dicas rápidas', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:24px 32px;">
      <h3 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;color:#0f172a;margin:0 0 12px;">
        💡 Dicas rápidas do mês
      </h3>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;line-height:1.5;">
            ✅ <strong>Dica 1:</strong> {{dica_1}}
          </p>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;line-height:1.5;">
            ✅ <strong>Dica 2:</strong> {{dica_2}}
          </p>
        </td></tr>
        <tr><td style="padding:8px 0;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;line-height:1.5;">
            ✅ <strong>Dica 3:</strong> {{dica_3}}
          </p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>
  $html$, 4);

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_soc_id, 'social', 'Social Links', '', 5);

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_ftr_id, 'footer', 'Footer Legal', '', 6);

  -- ── 4. Template: Promo / Black Friday ────────────────────────────────────────

  INSERT INTO public.email_templates (org_id, name, subject_line, preview_text, status, tags)
  VALUES (
    v_org_id,
    'Promo — Oferta Especial',
    '🔥 Oferta exclusiva: {{desconto}}% off por tempo limitado',
    'Não perca. Seu desconto exclusivo expira em {{prazo}} — válido somente para você.',
    'draft',
    ARRAY['promo', 'desconto', 'urgencia']
  ) RETURNING id INTO v_tpl_id;

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_hdr_id, 'header', 'Header Xphere', '', 0);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'hero', 'Hero — Oferta', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:56px 32px;text-align:center;">
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:#c7d2fe;text-transform:uppercase;letter-spacing:2px;margin:0 0 16px;">
        Oferta exclusiva
      </p>
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:56px;font-weight:900;color:#ffffff;margin:0 0 8px;line-height:1;">
        {{desconto}}%
      </h1>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:20px;font-weight:600;color:#e0e7ff;margin:0 0 8px;">
        de desconto no plano anual
      </p>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#c7d2fe;margin:0 0 32px;">
        Expira em {{prazo}} · Somente para contas ativas
      </p>
      <a href="#" style="display:inline-block;background-color:#ffffff;color:#6366f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:8px;">
        Aproveitar agora →
      </a>
    </td>
  </tr>
</table>
  $html$, 1);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'text', 'O que está incluso', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:32px;">
      <h2 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:18px;font-weight:600;color:#0f172a;margin:0 0 16px;text-align:center;">
        O que você ganha com o plano anual
      </h2>
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
        <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;">✅ Agentes de IA ilimitados</p>
        </td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;">✅ CRM completo com pipeline e automações</p>
        </td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;">✅ Integrações com WhatsApp, Google, Vapi e mais</p>
        </td></tr>
        <tr><td style="padding:10px 0;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;">✅ Suporte prioritário e onboarding dedicado</p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>
  $html$, 2);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'cta', 'CTA final — urgência', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:24px 32px 40px;text-align:center;">
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#94a3b8;margin:0 0 16px;">
        ⏰ Oferta válida até {{data_limite}} ou enquanto durarem as vagas.
      </p>
      <a href="#" style="display:inline-block;background-color:#6366f1;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">
        Garantir meu desconto
      </a>
    </td>
  </tr>
</table>
  $html$, 3);

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_ftr_id, 'footer', 'Footer Legal', '', 4);

  -- ── 5. Template: Feature Announcement ──────────────────────────────────────

  INSERT INTO public.email_templates (org_id, name, subject_line, preview_text, status, tags)
  VALUES (
    v_org_id,
    'Feature Announcement — Nova Funcionalidade',
    'Novo no Xphere: {{feature_name}} já disponível para você',
    'Construímos isso para você. Veja como {{feature_name}} resolve {{problema}} em menos de 2 minutos.',
    'draft',
    ARRAY['produto', 'feature', 'lancamento']
  ) RETURNING id INTO v_tpl_id;

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_hdr_id, 'header', 'Header Xphere', '', 0);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'hero', 'Hero — Lançamento', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:48px 32px 32px;text-align:center;">
      <span style="display:inline-block;background-color:#ecfdf5;color:#059669;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:600;padding:4px 12px;border-radius:99px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:20px;">
        Novo recurso
      </span>
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:30px;font-weight:700;color:#0f172a;margin:0 0 16px;line-height:1.3;">
        Apresentando: {{feature_name}}
      </h1>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.7;color:#475569;margin:0 0 32px;max-width:460px;display:inline-block;">
        {{feature_descricao_curta}}. Disponível agora mesmo no seu painel.
      </p>
      <a href="https://xphere.skale.club" style="display:inline-block;background-color:#059669;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
        Experimentar agora →
      </a>
    </td>
  </tr>
</table>
  $html$, 1);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'image', 'Screenshot da feature', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:0 32px 32px;">
      <img
        src="https://placehold.co/536x300/0f172a/6366f1?text={{feature_name}}"
        alt="Screenshot de {{feature_name}}"
        width="536" height="300"
        style="display:block;width:100%;border-radius:8px;border:1px solid #e2e8f0;"
      />
    </td>
  </tr>
</table>
  $html$, 2);

  INSERT INTO public.email_template_sections (template_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, 'text', 'Como funciona — 3 passos', $html$
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
  <tr>
    <td style="padding:0 32px 32px;background-color:#f8fafc;">
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
        <tr>
          <td style="padding:24px 0;">
            <h3 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;color:#0f172a;margin:0 0 16px;">Como usar em 3 passos</h3>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background-color:#ffffff;border-radius:8px;border-left:3px solid #6366f1;margin-bottom:8px;display:block;">
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;">
              <strong>1.</strong> {{passo_1}}
            </p>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background-color:#ffffff;border-radius:8px;border-left:3px solid #6366f1;">
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;">
              <strong>2.</strong> {{passo_2}}
            </p>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background-color:#ffffff;border-radius:8px;border-left:3px solid #6366f1;">
            <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;margin:0;">
              <strong>3.</strong> {{passo_3}}
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  $html$, 3);

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_soc_id, 'social', 'Social Links', '', 4);

  INSERT INTO public.email_template_sections (template_id, section_id, type, name, html_content, sort_order)
  VALUES (v_tpl_id, v_ftr_id, 'footer', 'Footer Legal', '', 5);

  RAISE NOTICE 'Seed concluído. 3 seções globais + 4 templates inseridos para org %', v_org_id;
END;
$$;
