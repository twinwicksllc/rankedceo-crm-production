import re

with open('app/smile/assessment/page.tsx', 'r') as f:
    content = f.read()

# Find and replace the function signature and initial lines
old_pattern = r'export default async function SmileAssessmentPage\(\{\s*searchParams,\s*\}: \{\s*searchParams: \{ dentistId\?: string \}\s*\}\) \{\s*const dentistId = searchParams\.dentistId\s*return \('

new_code = '''export default async function SmileAssessmentPage({
     searchParams,
   }: {
     searchParams: { dentistId?: string }
   }) {
     const dentistId = searchParams.dentistId
     
     // Pool Account ID for fallback (used if no dentistId in URL)
     const POOL_ACCOUNT_ID = '00000000-0000-4000-a000-000000000004'
     
     // Use Pool Account ID if no dentistId provided
     const finalDentistId = dentistId || POOL_ACCOUNT_ID
     
     return ('''

content = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

with open('app/smile/assessment/page.tsx', 'w') as f:
    f.write(content)

print('✓ Updated smile assessment page with Pool Account fallback')