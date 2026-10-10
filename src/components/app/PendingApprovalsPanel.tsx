import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, XCircle, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/PageKit";

type RecordTable = "animals" | "animal_batches" | "inventory_items";
type PendingRow =
 | { kind: "new-record"; id: string; label: string; detail: string; table: RecordTable }
 | { kind: "change-request"; id: string; label: string; detail: string; recordType: "animal" | "batch"; requestType: "edit" | "delete"; reason: string; proposed: unknown; original: unknown };

export function PendingApprovalsPanel() {
 const { user, hasRole } = useAuth();
 const qc = useQueryClient();
 const canApprove = hasRole("ceo") || hasRole("administrator");
 const query = useQuery({
  queryKey: ["record-approvals-pending"],
  enabled: canApprove,
  queryFn: async (): Promise<PendingRow[]> => {
   const db = supabase as any;
   const [a,b,i,requests] = await Promise.all([
    db.from("animals").select("id,tag_number,created_at").eq("approval_status","pending").order("created_at",{ascending:false}),
    db.from("animal_batches").select("id,batch_code,initial_quantity,created_at").eq("approval_status","pending").order("created_at",{ascending:false}),
    db.from("inventory_items").select("id,name,unit,submitted_quantity,created_at").eq("approval_status","pending").order("created_at",{ascending:false}),
    db.from("record_change_requests").select("id,record_type,record_id,request_type,record_label,reason,proposed_values,original_values,requested_at").eq("status","pending").order("requested_at",{ascending:false})
   ]);
   for (const result of [a,b,i,requests]) if(result.error) throw result.error;
   return [
    ...(a.data??[]).map((x:any)=>({kind:"new-record" as const,id:x.id,label:x.tag_number,detail:"New individual livestock awaiting approval",table:"animals" as const})),
    ...(b.data??[]).map((x:any)=>({kind:"new-record" as const,id:x.id,label:x.batch_code,detail:`New batch · ${x.initial_quantity} submitted`,table:"animal_batches" as const})),
    ...(i.data??[]).map((x:any)=>({kind:"new-record" as const,id:x.id,label:x.name,detail:`New inventory · ${x.submitted_quantity??0} ${x.unit}`,table:"inventory_items" as const})),
    ...(requests.data??[]).map((x:any)=>({kind:"change-request" as const,id:x.id,label:x.record_label,detail:`${x.request_type==="delete"?"Deletion":"Edit"} request · ${x.record_type==="animal"?"Individual livestock":"Livestock batch"}`,recordType:x.record_type,requestType:x.request_type,reason:x.reason,proposed:x.proposed_values,original:x.original_values}))
   ];
  }
 });
 async function decide(row:PendingRow, decision:"approved"|"rejected") {
  if(!canApprove||!user)return;
  const db=supabase as any;
  let error:any=null;
  if(row.kind==="change-request") {
   const rejectionReason = decision==="rejected" ? (window.prompt("Reason for rejecting this request?")?.trim() || "") : null;
   if(decision==="rejected"&&!rejectionReason){toast.error("Enter a reason to reject this request.");return;}
   const result=await db.rpc("review_record_change_request",{p_request_id:row.id,p_decision:decision,p_rejection_reason:rejectionReason});
   error=result.error;
  } else {
   const result=await db.from(row.table).update({approval_status:decision,rejection_reason:decision==="rejected"?"Rejected by CEO/Administrator":null,approved_by:decision==="approved"?user.id:null,approved_at:decision==="approved"?new Date().toISOString():null}).eq("id",row.id).eq("approval_status","pending");
   error=result.error;
  }
  if(error){toast.error(error.message);return;}
  toast.success(decision==="approved"?"Request approved":"Request rejected");
  await Promise.all([
   qc.invalidateQueries({queryKey:["record-approvals-pending"]}),
   qc.invalidateQueries({queryKey:["dashboard-live-data"]}),
   qc.invalidateQueries({queryKey:["livestock"]}),
   qc.invalidateQueries({queryKey:["inventory-items"]}),
  ]);
 }
 if(!canApprove)return null;
 return <Panel title="Pending approvals" action={<span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="h-4 w-4"/>{query.data?.length??0} waiting</span>}>
  {query.isError?<p className="text-sm text-destructive">Could not load approvals: {(query.error as Error).message}</p>:query.isLoading?<p className="text-sm text-muted-foreground">Loading pending records…</p>:!query.data?.length?<p className="text-sm text-muted-foreground">There are no records waiting for approval.</p>:
   <div className="space-y-3">{query.data.map(row=><div key={row.kind+row.id} className="rounded-lg border p-3 space-y-2">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
     <div className="min-w-0"><p className="font-semibold">{row.label}</p><p className="text-sm text-muted-foreground">{row.detail}</p>
      {row.kind==="change-request"&&<><p className="mt-2 text-sm"><strong>Secretary's reason:</strong> {row.reason}</p>{row.requestType==="edit"&&<details className="mt-2 text-sm"><summary className="cursor-pointer font-medium">Review proposed changes</summary><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><p className="font-medium">Current values</p><pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{JSON.stringify(row.original,null,2)}</pre></div><div><p className="font-medium">Proposed values</p><pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">{JSON.stringify(row.proposed,null,2)}</pre></div></div></details>}</>}
     </div>
     <div className="flex shrink-0 gap-2"><Button size="sm" onClick={()=>void decide(row,"approved")}><CheckCircle2 className="mr-1 h-4 w-4"/>Approve</Button><Button size="sm" variant="outline" onClick={()=>void decide(row,"rejected")}><XCircle className="mr-1 h-4 w-4"/>Reject</Button></div>
    </div>
   </div>)}</div>}
 </Panel>;
}
