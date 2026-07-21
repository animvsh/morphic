export function describesCurrentBeevrProduct(text: string): boolean {
  const namesCompanyBrain =
    /(company's (?:ai )?brain|company brain|answers with sources)/i.test(text)
  const explainsInfrastructure =
    /agent infrastructure/i.test(text) &&
    /(ai brain|persistent ["']?brain|connects (?:to )?(?:a )?company's tools|business tools|shared memory|memory layer|memory|context|reason|act|tool connectivity)/i.test(
      text
    )
  const describesConnectedBusinessData =
    /(docs|chats|crm|business data)/i.test(text) &&
    /(connects|understands|answers|insights)/i.test(text)
  const describesAgentBrain =
    /(gives? agents? a brain|agents? a brain)/i.test(text) &&
    /(connects|company's tools|shared memory|reason|act)/i.test(text)
  const describesKnowledgePlatform =
    /ai knowledge platform for businesses/i.test(text)

  const describesBrainForCompanies =
    /\b(?:ai|agent|company|persistent)\s+["']?brain\b/i.test(text) &&
    /\b(?:companies|company|businesses|business|agents?)\b/i.test(text)
  const connectsCompanyTools =
    /\bconnects?\b/i.test(text) &&
    /\b(?:company(?:'s)?\s+)?(?:tools?|docs?|chats?|crm|business data)\b/i.test(
      text
    )
  const enablesAgentReasoning =
    /\b(?:enables?|allows?|helps?)\b[^.!?]{0,100}\bagents?\b[^.!?]{0,80}\b(?:reason|reasoning|act|answer|use context)\b/i.test(
      text
    )
  const describesConnectedAgentPlatform =
    /\b(?:ai\s+)?(?:platform|infrastructure|memory layer)\b/i.test(text) &&
    /\b(?:connects? (?:to )?(?:company|business)(?:'s)? tools|shared memory)\b/i.test(
      text
    ) &&
    /\bagents?\b/i.test(text) &&
    /\b(?:reason|reasoning|act|answer)\b/i.test(text)

  return (
    namesCompanyBrain ||
    explainsInfrastructure ||
    describesConnectedBusinessData ||
    describesAgentBrain ||
    describesKnowledgePlatform ||
    describesConnectedAgentPlatform ||
    (describesBrainForCompanies &&
      (connectsCompanyTools || enablesAgentReasoning))
  )
}
