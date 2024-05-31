"use server";

import { LogEvents } from "@midday/events/events";
import { setupLogSnag } from "@midday/events/server";
import { getUser } from "@midday/supabase/cached-queries";
import { createClient } from "@midday/supabase/server";
import { nanoid } from "nanoid";
import { revalidateTag } from "next/cache";
import { action } from "./safe-action";
import { createBankAccountSchema } from "./schema";

export const createBankAccountAction = action(
  createBankAccountSchema,
  async ({ name, currency }) => {
    const supabase = createClient();
    const user = await getUser();
    const teamId = user?.data?.team_id;

    const { data, error } = await supabase
      .from("decrypted_bank_accounts")
      .insert({
        name,
        currency,
        team_id: teamId,
        created_by: user?.data?.id,
        enabled: true,
        account_id: nanoid(),
        manual: true,
      })
      .select("id, name:decrypted_name")
      .single();

    if (error) {
      throw Error(error.message);
    }

    revalidateTag(`bank_accounts_${teamId}`);
    revalidateTag(`bank_accounts_currencies_${teamId}`);

    const logsnag = await setupLogSnag({
      userId: user.data.id,
      fullName: user.data.full_name,
    });

    logsnag.track({
      event: LogEvents.BankAccountCreate.name,
      icon: LogEvents.BankAccountCreate.icon,
      channel: LogEvents.BankAccountCreate.channel,
    });

    return data;
  }
);