-- :phase is set by psql -v phase=...
\set A '''a1a1a1a1-0000-0000-0000-000000000001'''
\set B '''b2b2b2b2-0000-0000-0000-000000000002'''
\set AA '''aaaaaaaa-0000-0000-0000-000000000001'''
\set BB '''bbbbbbbb-0000-0000-0000-000000000002'''
select public.expect(:'phase','A reads own contacts (RLS helper needs EXECUTE)','authenticated',:A::uuid,'a@example.com','select count(*)::text from public.contacts','1');
select public.expect(:'phase','A calls get_current_user_account_id','authenticated',:A::uuid,'a@example.com','select get_current_user_account_id()::text',:AA);
select public.expect(:'phase','A onboarding: update own company info','authenticated',:A::uuid,'a@example.com',format('select update_company_info(%L::uuid,''N'',''1-10'',''hvac'',''w'',''p'',''ad'')::text',:AA),'OK');
select public.expect(:'phase','A onboarding: complete own account','authenticated',:A::uuid,'a@example.com',format('select complete_onboarding(%L::uuid)::text',:AA),'OK');
select public.expect(:'phase','A onboarding: update own preferences','authenticated',:A::uuid,'a@example.com',format('select update_preferences(%L::uuid,''UTC'',''{}''::jsonb)::text',:AA),'OK');
select public.expect(:'phase','A onboarding: skip own account','authenticated',:A::uuid,'a@example.com',format('select skip_onboarding(%L::uuid)::text',:AA),'OK');
select public.expect(:'phase','A onboarding: step on own account','authenticated',:A::uuid,'a@example.com',format('select update_onboarding_step(%L::uuid,3)::text',:AA),'OK');
select public.expect(:'phase','A must NOT update B company info','authenticated',:A::uuid,'a@example.com',format('select update_company_info(%L::uuid,''HACKED'',''x'',''x'',''x'',''x'',''x'')::text',:BB),'ERR');
select public.expect(:'phase','A must NOT complete B onboarding','authenticated',:A::uuid,'a@example.com',format('select complete_onboarding(%L::uuid)::text',:BB),'ERR');
select public.expect(:'phase','A must NOT change B preferences','authenticated',:A::uuid,'a@example.com',format('select update_preferences(%L::uuid,''HACK'',''{}''::jsonb)::text',:BB),'ERR');
select public.expect(:'phase','A must NOT skip B onboarding','authenticated',:A::uuid,'a@example.com',format('select skip_onboarding(%L::uuid)::text',:BB),'ERR');
select public.expect(:'phase','A must NOT set B step','authenticated',:A::uuid,'a@example.com',format('select update_onboarding_step(%L::uuid,5)::text',:BB),'ERR');
select public.expect(:'phase','anon must NOT call get_current_user_account_id','anon',null,null,'select get_current_user_account_id()::text','ERR');
select public.expect(:'phase','anon must NOT call update_company_info','anon',null,null,format('select update_company_info(%L::uuid,''H'',''x'',''x'',''x'',''x'',''x'')::text',:BB),'ERR');
select public.expect(:'phase','anon reads no contacts (RLS returns 0 rows)','anon',null,null,'select count(*)::text from public.contacts','0');
select public.expect(:'phase','service_role can run onboarding RPC','service_role',null,null,format('select complete_onboarding(%L::uuid)::text',:AA),'OK');
select public.expect(:'phase','authenticated must NOT call conversation-style RPCs left revoked (assert_own_account absent pre-fix)','authenticated',:A::uuid,'a@example.com',format('select assert_own_account(%L::uuid)::text',:AA),case when :'phase'='before' then 'ERR' else 'OK' end);
