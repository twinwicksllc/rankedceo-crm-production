import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountId } from "@/lib/services/account-context";
import {
  Contact,
  CreateContactInput,
  UpdateContactInput,
} from "@/lib/types/contact";
import {
  createContactSchema,
  updateContactSchema,
} from "@/lib/validations/contact";

/** Filters accepted by getContacts(). */
export interface ContactFilters {
  search?: string;
  company_id?: string;
}

export class ContactService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    // Don't initialize client in constructor - will be lazy-loaded
  }

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  async createContact(input: CreateContactInput): Promise<Contact> {
    const validatedInput = createContactSchema.parse(input);

    const client = await this.getClient();

    const {
      data: { user },
    } = await (await this.getClient()).auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // users.id IS the auth uid; accounts has no user_id column. The helper
    // also covers a legacy profile whose id is not the auth id.
    const accountId = await resolveAccountId(client, user);

    const { data, error } = await client
      .from("contacts")
      .insert({
        account_id: accountId,
        user_id: user.id,
        ...validatedInput,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return data as Contact;
  }

  async getContacts(filters: ContactFilters = {}): Promise<Contact[]> {
    const client = await this.getClient();

    let query = client
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
      );
    }

    if (filters.company_id) {
      query = query.eq("company_id", filters.company_id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    return data as Contact[];
  }

  async getContactById(id: string): Promise<Contact | null> {
    const client = await this.getClient();

    const { data, error } = await client
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }

    return data as Contact;
  }

  async updateContact(id: string, input: UpdateContactInput): Promise<Contact> {
    const validatedInput = updateContactSchema.parse(input);
    const client = await this.getClient();

    const { data, error } = await client
      .from("contacts")
      .update(validatedInput)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return data as Contact;
  }

  async deleteContact(id: string): Promise<void> {
    const client = await this.getClient();

    const { error } = await client.from("contacts").delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
  }

  async getContactStats() {
    const client = await this.getClient();

    const { data, error } = await client.from("contacts").select("status");

    if (error) {
      throw new Error(`Failed to fetch contact stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      active: 0,
      inactive: 0,
      prospect: 0,
    };

    data?.forEach((contact) => {
      if (contact.status === "active") stats.active++;
      if (contact.status === "inactive") stats.inactive++;
      if (contact.status === "prospect") stats.prospect++;
    });

    return stats;
  }
}

export const contactService = new ContactService();
