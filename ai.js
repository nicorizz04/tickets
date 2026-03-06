// ai.js - helper for interacting with Gemini
export const GEMINI_API_KEY = 'AIzaSyC1u2VDVrSUomQ4VtjFUN8YZtKqpBlMIg4';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText';

// Fallback local classification (no API needed)
export function localClassify(description) {
  console.log('[LocalClassify] Using fallback...');
  
  const desc = description.toLowerCase();
  
  // Hardware keywords
  const hardwareKeywords = ['tastatur', 'laptop', 'ecran', 'monitor', 'mouse', 'hard drive', 'ssd', 'ram', 'cpu', 'plac', 'imprimant', 'curacar', 'cablu', 'port', 'usb', 'alimentator', 'cooler', 'ventilator', 'router', 'wifi', 'baterie', 'incarcator'];
  
  // Software keywords
  const softwareKeywords = ['software', 'program', 'aplicatie', 'eroare', 'crash', 'update', 'sistem operare', 'driver', 'windows', 'linux', 'virus', 'antivirus', 'email', 'browser', 'bug', 'freeze', 'ingheta', 'database', 'server'];
  
  let hardwareScore = 0;
  let softwareScore = 0;
  
  hardwareKeywords.forEach(kw => {
    if (desc.includes(kw)) hardwareScore += 2;
  });
  
  softwareKeywords.forEach(kw => {
    if (desc.includes(kw)) softwareScore += 2;
  });
  
  const category = hardwareScore > softwareScore ? 'Hardware' : 'Software';
  
  // Priority - HIGH keywords
  const highKeywords = ['urgent', 'grav', 'critical', 'crash', 'nu merge', 'nu pot lucra', 'blochează', 'virus', 'malware', 'pierzut', 'pierdut', 'pierde date', 'pierdere date', 'nu pot'];
  
  // Priority - MEDIUM keywords
  const mediumKeywords = ['lent', 'problema', 'eroare', 'intermitent', 'greşeală', 'scapi', 'nu functioneaza bine'];
  
  // Priority - LOW keywords
  const lowKeywords = ['info', 'intrebare', 'sfat', 'minor', 'mic', 'optional'];
  
  let priority = 'Medium';
  
  if (highKeywords.some(kw => desc.includes(kw))) {
    priority = 'High';
  } else if (lowKeywords.some(kw => desc.includes(kw))) {
    priority = 'Low';
  }
  
  console.log(`[LocalClassify] Result: ${category}, ${priority}`);
  return { category, priority };
}

// low-level call
async function callGemini(prompt) {
  console.log('[Gemini] Calling API...');
  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    console.log('[Gemini] Response status:', res.status);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('[Gemini] Response data:', JSON.stringify(data).substring(0, 200) + '...');
    
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[Gemini] Extracted text:', text);
    return text;
  } catch (err) {
    console.error('[Gemini] Error:', err);
    throw err;
  }
}

// classify a ticket description
export async function classifyTicket(description) {
  console.log('[ClassifyTicket] Starting with:', description.substring(0, 50) + '...');
  
  const prompt = `You are an expert IT support technician. Analyze this problem description and classify it into category and priority.

CATEGORY RULES:
- If mentions: screen, monitor, keyboard, mouse, hard drive, SSD, HDD, RAM, CPU, motherboard, printer, network cable, power supply, display, webcam, port, USB, router, wifi, charger, battery, sensor, heatsink, coolant, etc → "Hardware"
- If mentions: software, application, program, error, bug, crash, freeze, hang, update, OS, driver, Windows, Linux, Mac, virus, malware, antivirus, email, browser, database, server, cloud, installation, crash, permission, file, backup, etc → "Software"
- If both mentioned, choose what is the ROOT CAUSE

PRIORITY RULES (VERY IMPORTANT):
- "High" priority if: virus, malware, crash, cannot work, blocking, critical, emergency, urgent, data loss risk, security risk, "nu merge", "nu pot lucra", "blochează", "pierzut date", "nu pot accesa"
- "Medium" priority if: error, performance issue, slow, minor crash, intermittent, "lent", "greșeală", "problematic"
- "Low" priority if: information only, feature request, minor annoyance, question, "minor", "mic"

RESPONSE FORMAT:
Respond ONLY with valid JSON on one line, no markdown, no explanation:
{"category":"Hardware or Software","priority":"Low or Medium or High"}

User problem: "${description}"`;

  try {
    const text = await callGemini(prompt);
    console.log('[ClassifyTicket] Raw response:', text);
    
    // Try to extract JSON
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) {
      console.error('[ClassifyTicket] No JSON found in response, using local fallback');
      return localClassify(description);
    }
    
    const jsonStr = match[0];
    console.log('[ClassifyTicket] Extracted JSON:', jsonStr);
    
    const parsed = JSON.parse(jsonStr);
    console.log('[ClassifyTicket] Parsed successfully:', parsed);
    return parsed;
  } catch (e) {
    console.error('[ClassifyTicket] Error:', e);
    console.log('[ClassifyTicket] Using local fallback');
    return localClassify(description);
  }
}

// helper that returns only category
export async function detectCategory(description) {
  const res = await classifyTicket(description);
  return res.category;
}

// helper that returns only priority/severity
export async function detectPriority(description) {
  const res = await classifyTicket(description);
  return res.priority;
}

// summarize tickets array
export async function summarizeTickets(tickets) {
  console.log('[SummarizeTickets] Count:', tickets.length);
  if (tickets.length === 0) return 'Nu sunt tichete de analizat.';
  
  const short = tickets.map(t => `- ${t.description || ''} (${t.category}, ${t.status}, Priority:${t.priority})`).join('\n');
  const prompt = `Rezuma următoarele tichete IT într-un text scurt (50-100 cuvinte), menționând câți sunt pending/completed și categoriile principale:
${short}`;
  try {
    const text = await callGemini(prompt);
    console.log('[SummarizeTickets] Summary:', text);
    return text.trim();
  } catch (err) {
    console.error('[SummarizeTickets] Error:', err);
    // Local summary
    const pending = tickets.filter(t => t.status === 'Pending').length;
    const completed = tickets.filter(t => t.status === 'Completed').length;
    const categories = [...new Set(tickets.map(t => t.category))].join(', ');
    return `Total: ${tickets.length} tichete (${pending} Pending, ${completed} Completed). Categorii: ${categories}`;
  }
}
