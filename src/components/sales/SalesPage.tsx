
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Users,
  Wallet,
  Search,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatNaira } from "@/lib/access";
import { getLocalDateInputValue } from "@/lib/date-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  RequirePermission,
} from "@/components/app/PageKit";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

type Sale = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  sale_date: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type SaleItemDraft = {
  kind: "animal" | "batch";
  record_id: string;
  quantity: string;
  unit_price: string;
};

type Section = "customers" | "invoices" | "payments" | "receipts";

const money = (amount: number) => formatNaira(Number(amount) || 0);

function SalesContent() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const canManage = can("sales.manage");
  const [section, setSection] = useState<Section>("customers");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [saleDialog, setSaleDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saleItems, setSaleItems] = useState<SaleItemDraft[]>([
    { kind: "animal", record_id: "", quantity: "1", unit_price: "" },
  ]);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const [saleForm, setSaleForm] = useState({
    customer_id: "",
    total_amount: "",
    amount_paid: "0",
    sale_date: getLocalDateInputValue(),
    notes: "",
  });

  const customersQuery = useQuery({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");

      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const salesQuery = useQuery({
    queryKey: ["sales-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("sale_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  const animalsQuery = useQuery({
    queryKey: ["sales-available-animals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animals")
        .select("id, tag_number, livestock_type_id, acquisition_cost, status")
        .eq("status", "active")
        .eq("approval_status", "approved")
        .order("tag_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["sales-available-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animal_batches")
        .select("id, batch_code, livestock_type_id, current_quantity, initial_quantity, acquisition_cost, status")
        .eq("status", "active")
        .eq("approval_status", "approved")
        .gt("current_quantity", 0)
        .order("batch_code");
      if (error) throw error;
      return data ?? [];
    },
  });

  const livestockTypesQuery = useQuery({
    queryKey: ["sales-livestock-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestock_types")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const customers = customersQuery.data ?? [];
  const sales = salesQuery.data ?? [];
  const availableAnimals = animalsQuery.data ?? [];
  const availableBatches = batchesQuery.data ?? [];
  const livestockTypeNames = useMemo(
    () => new Map((livestockTypesQuery.data ?? []).map((type) => [type.id, type.name])),
    [livestockTypesQuery.data],
  );
  const saleItemTotal = saleItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0,
  );

  const customerNames = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.name])),
    [customers],
  );

  // Financial summary cards exclude cancelled, void and draft invoices; those remain visible in the invoice history.
  const financiallyRelevantSales = sales.filter((sale) =>
    ["completed", "approved"].includes(String(sale.status ?? "").toLowerCase()),
  );
  const totalSales = financiallyRelevantSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0,
  );
  const totalPaid = financiallyRelevantSales.reduce(
    (sum, sale) => sum + Number(sale.amount_paid || 0),
    0,
  );
  const outstanding = financiallyRelevantSales.reduce(
    (sum, sale) =>
      sum + Math.max(0, Number(sale.total_amount || 0) - Number(sale.amount_paid || 0)),
    0,
  );

  const filteredCustomers = customers.filter((customer) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      customer.name.toLowerCase().includes(term) ||
      (customer.phone ?? "").toLowerCase().includes(term) ||
      (customer.email ?? "").toLowerCase().includes(term)
    );
  });

  const filteredSales = sales.filter((sale) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      sale.invoice_number.toLowerCase().includes(term) ||
      (customerNames.get(sale.customer_id ?? "") ?? "")
        .toLowerCase()
        .includes(term) ||
      sale.payment_status.toLowerCase().includes(term)
    );
  });

  function refreshData() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales-customers"] }),
      queryClient.invalidateQueries({ queryKey: ["sales-records"] }),
      queryClient.invalidateQueries({ queryKey: ["sales-available-animals"] }),
      queryClient.invalidateQueries({ queryKey: ["sales-available-batches"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-live-data"] }),
      queryClient.invalidateQueries({ queryKey: ["reports-sales"] }),
      queryClient.invalidateQueries({ queryKey: ["reports-sale-items"] }),
      queryClient.invalidateQueries({ queryKey: ["reports-animals"] }),
      queryClient.invalidateQueries({ queryKey: ["reports-batches"] }),
    ]);
  }

  function openCustomerDialog() {
    setCustomerForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
    setCustomerDialog(true);
  }

  function openSaleDialog() {
    setSaleForm({
      customer_id: "",
      total_amount: "",
      amount_paid: "0",
      sale_date: getLocalDateInputValue(),
      notes: "",
    });
    setSaleItems([{ kind: "animal", record_id: "", quantity: "1", unit_price: "" }]);
    setSaleDialog(true);
  }

  async function saveCustomer() {
    if (!canManage) {
      alert("You do not have permission to manage customers.");
      return;
    }

    if (!customerForm.name.trim()) {
      alert("Enter the customer's name.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("customers").insert({
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || null,
        email: customerForm.email.trim() || null,
        address: customerForm.address.trim() || null,
        notes: customerForm.notes.trim() || null,
      });

      if (error) throw error;

      setCustomerDialog(false);
      await refreshData();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save the customer.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveSale() {
    if (!canManage) {
      alert("You do not have permission to record sales.");
      return;
    }

    if (saleItems.length === 0 || saleItems.some((item) => !item.record_id)) {
      alert("Add a livestock item and select the animal or batch for every line.");
      return;
    }

    if (saleItems.some((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      return (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        (item.kind === "animal" && quantity !== 1) ||
        (item.kind === "batch" && !Number.isInteger(quantity)) ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      );
    })) {
      alert("Check each item quantity and unit price. Batch quantities must be whole numbers.");
      return;
    }

    const total = saleItems.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
      0,
    );
    const paid = Number(saleForm.amount_paid || 0);

    if (!Number.isFinite(total) || total <= 0) {
      alert("The livestock items must have a total sale value greater than zero.");
      return;
    }

    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      alert("The initial payment must be between zero and the sale total.");
      return;
    }

    if (!saleForm.sale_date) {
      alert("Select the sale date.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("create_livestock_sale", {
        p_customer_id: saleForm.customer_id || (null as unknown as string),
        p_sale_date: saleForm.sale_date,
        p_amount_paid: paid,
        p_notes: saleForm.notes.trim() || (null as unknown as string),
        p_items: saleItems.map((item) => ({
          kind: item.kind,
          record_id: item.record_id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
      });

      if (error) throw error;

      setSaleDialog(false);
      setSaleItems([{ kind: "animal", record_id: "", quantity: "1", unit_price: "" }]);
      await refreshData();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-available-animals"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-available-batches"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-sales"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-sale-items"] }),
        queryClient.invalidateQueries({ queryKey: ["reports-animals"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-income"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-live-data"] }),
        queryClient.invalidateQueries({ queryKey: ["ceo-office-live-data"] }),
      ]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not create the sales invoice.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openPaymentDialog(sale: Sale) {
    setSelectedSale(sale);
    setPaymentAmount("");
    setPaymentDialog(true);
  }

  async function savePayment() {
    if (!canManage) {
      alert("You do not have permission to record payments.");
      return;
    }

    if (!selectedSale) return;

    const amount = Number(paymentAmount);
    const total = Number(selectedSale.total_amount);
    const paid = Number(selectedSale.amount_paid || 0);
    const balance = Math.max(0, total - paid);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a payment amount greater than zero.");
      return;
    }

    if (amount > balance) {
      alert(`Payment cannot exceed the outstanding balance of ${money(balance)}.`);
      return;
    }

    const newPaid = paid + amount;
    const newStatus =
      newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "unpaid";

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("sales")
        .update({
          amount_paid: newPaid,
          payment_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedSale.id)
        .eq("amount_paid", paid)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error(
          "This sale was updated elsewhere. Refresh the page and try again.",
        );
      }

      setSelectedSale(data as Sale);
      setPaymentDialog(false);
      setReceiptDialog(true);
      await Promise.all([
        refreshData(),
        queryClient.invalidateQueries({ queryKey: ["finance-income"] }),
        queryClient.invalidateQueries({ queryKey: ["finance-expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-live-data"] }),
        queryClient.invalidateQueries({ queryKey: ["ceo-office-live-data"] }),
      ]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not record the payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  function showReceipt(sale: Sale) {
    setSelectedSale(sale);
    setReceiptDialog(true);
  }

  const loading = customersQuery.isLoading || salesQuery.isLoading;
  const queryError = customersQuery.error || salesQuery.error;

  const sections: {
    id: Section;
    label: string;
    icon: typeof Users;
  }[] = [
    { id: "customers", label: "Customers", icon: Users },
    { id: "invoices", label: "Sales Bills", icon: FileText },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "receipts", label: "Receipts", icon: Receipt },
  ];

  return (
    <RequirePermission perm="sales.view">
      <div className="space-y-6">
        <PageHeader
          title="Sales and Customers"
          description="See what you sold, how much customers have paid, and how much they still owe."
          actions={
            <Button
              variant="outline"
              onClick={() => void refreshData()}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />

        {queryError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            Could not load sales data:{" "}
            {queryError instanceof Error
              ? queryError.message
              : "Please try refreshing the page."}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Customers"
            value={String(customers.length)}
            icon={Users}
          />
          <SummaryCard
            title="Total Sales"
            value={money(totalSales)}
            icon={FileText}
          />
          <SummaryCard
            title="Payments Received"
            value={money(totalPaid)}
            icon={Wallet}
          />
          <SummaryCard
            title="Money Customers Still Owe"
            value={money(outstanding)}
            icon={Receipt}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-b pb-3">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={section === item.id ? "default" : "outline"}
                onClick={() => {
                  setSection(item.id);
                  setSearch("");
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={
                section === "customers"
                  ? "Search customers..."
                  : "Search invoices or customers..."
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {canManage && section === "customers" && (
            <Button onClick={openCustomerDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          )}

          {canManage && section === "invoices" && (
            <Button onClick={openSaleDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border p-10 text-center text-muted-foreground">
            Loading sales data...
          </div>
        ) : (
          <>
            {section === "customers" && (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 font-medium">Customer</th>
                      <th className="p-3 font-medium">Phone</th>
                      <th className="p-3 font-medium">Email</th>
                      <th className="p-3 font-medium">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="border-t">
                        <td className="p-3 font-medium">{customer.name}</td>
                        <td className="p-3">{customer.phone || "—"}</td>
                        <td className="p-3">{customer.email || "—"}</td>
                        <td className="p-3">{customer.address || "—"}</td>
                      </tr>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <EmptyRow
                        message="No customers found. Add your first customer to get started."
                        columns={4}
                      />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {section === "invoices" && (
              <SalesTable
                sales={filteredSales}
                customerNames={customerNames}
                onPayment={openPaymentDialog}
                onReceipt={showReceipt}
                canManage={canManage}
              />
            )}

            {section === "payments" && (
              <SalesTable
                sales={filteredSales}
                customerNames={customerNames}
                onPayment={openPaymentDialog}
                onReceipt={showReceipt}
                canManage={canManage}
                paymentsOnly
              />
            )}

            {section === "receipts" && (
              <SalesTable
                sales={filteredSales}
                customerNames={customerNames}
                onPayment={openPaymentDialog}
                onReceipt={showReceipt}
                canManage={canManage}
                receiptsOnly
              />
            )}
          </>
        )}

        <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Customer</DialogTitle>
              <DialogDescription>
                Enter the customer's contact information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <FormField label="Customer name *">
                <Input
                  value={customerForm.name}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, name: e.target.value })
                  }
                  placeholder="Customer or business name"
                />
              </FormField>
              <FormField label="Phone number">
                <Input
                  value={customerForm.phone}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, phone: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, email: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Address">
                <Input
                  value={customerForm.address}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, address: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Notes">
                <Textarea
                  value={customerForm.notes}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, notes: e.target.value })
                  }
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCustomerDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveCustomer} disabled={saving}>
                {saving ? "Saving..." : "Save Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={saleDialog} onOpenChange={setSaleDialog}>
          <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create a Sales Bill</DialogTitle>
              <DialogDescription>
                Select the actual animal or batch being sold. Saving the invoice records the sale and reduces available livestock stock automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <FormField label="Customer">
                <Select
                  value={saleForm.customer_id || "walk-in"}
                  onValueChange={(value) =>
                    setSaleForm({
                      ...saleForm,
                      customer_id: value === "walk-in" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">Walk-in customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Livestock sold</h3>
                    <p className="text-xs text-muted-foreground">Individual animals are sold one at a time; batches allow whole-number quantities.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSaleItems((items) => [...items, { kind: "animal", record_id: "", quantity: "1", unit_price: "" }])}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add item
                  </Button>
                </div>

                {saleItems.map((item, itemIndex) => {
                  const selectedBatch = availableBatches.find((batch) => batch.id === item.record_id);
                  const selectedAnimal = availableAnimals.find((animal) => animal.id === item.record_id);
                  return (
                    <div key={itemIndex} className="grid gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-2">
                      <FormField label="Livestock record type">
                        <Select
                          value={item.kind}
                          onValueChange={(value) => {
                            const kind: "animal" | "batch" = value === "batch" ? "batch" : "animal";
                            setSaleItems((items) => items.map((current, index) => index === itemIndex
                              ? { ...current, kind, record_id: "", quantity: kind === "animal" ? "1" : "" }
                              : current));
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="animal">Individual animal</SelectItem>
                            <SelectItem value="batch">Batch / group</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField label={item.kind === "animal" ? "Select animal *" : "Select batch *"}>
                        <Select
                          value={item.record_id || "none"}
                          onValueChange={(value) => setSaleItems((items) => items.map((current, index) => index === itemIndex ? { ...current, record_id: value === "none" ? "" : value } : current))}
                        >
                          <SelectTrigger><SelectValue placeholder="Choose livestock" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Choose livestock...</SelectItem>
                            {item.kind === "animal" ? availableAnimals.map((animal) => (
                              <SelectItem key={animal.id} value={animal.id}>
                                {animal.tag_number} · {livestockTypeNames.get(animal.livestock_type_id) ?? "Livestock"}
                              </SelectItem>
                            )) : availableBatches.map((batch) => (
                              <SelectItem key={batch.id} value={batch.id}>
                                {batch.batch_code} · {livestockTypeNames.get(batch.livestock_type_id) ?? "Livestock"} · {batch.current_quantity} available
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormField>

                      <FormField label={item.kind === "animal" ? "Quantity" : "Quantity to sell *"}>
                        <Input
                          type="number"
                          min="1"
                          max={item.kind === "batch" ? selectedBatch?.current_quantity : 1}
                          step="1"
                          value={item.quantity}
                          disabled={item.kind === "animal"}
                          onChange={(event) => setSaleItems((items) => items.map((current, index) => index === itemIndex ? { ...current, quantity: event.target.value } : current))}
                        />
                      </FormField>

                      <FormField label="Unit sale price (₦) *">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) => setSaleItems((items) => items.map((current, index) => index === itemIndex ? { ...current, unit_price: event.target.value } : current))}
                          placeholder="Enter price per animal/bird/fish"
                        />
                      </FormField>

                      <div className="flex items-center justify-between gap-2 md:col-span-2">
                        <span className="text-sm text-muted-foreground">
                          Line total: <strong className="text-foreground">{money((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</strong>
                          {item.kind === "animal" && selectedAnimal ? <span> · {selectedAnimal.tag_number}</span> : null}
                        </span>
                        {saleItems.length > 1 && (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setSaleItems((items) => items.filter((_, index) => index !== itemIndex))}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="font-semibold">Invoice total</span>
                  <span className="text-lg font-bold">{money(saleItemTotal)}</span>
                </div>
                {animalsQuery.isError || batchesQuery.isError ? (
                  <p className="text-sm text-destructive">Could not load available livestock. Refresh and try again.</p>
                ) : null}
              </div>

              <FormField label="Amount paid now (₦)">
                <Input
                  type="number"
                  min="0"
                  max={saleItemTotal}
                  step="0.01"
                  value={saleForm.amount_paid}
                  onChange={(e) => setSaleForm({ ...saleForm, amount_paid: e.target.value })}
                />
              </FormField>
              <FormField label="Sale date *">
                <Input
                  type="date"
                  value={saleForm.sale_date}
                  onChange={(e) => setSaleForm({ ...saleForm, sale_date: e.target.value })}
                />
              </FormField>
              <FormField label="Notes">
                <Textarea
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                  placeholder="Optional notes for this invoice"
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaleDialog(false)}>Cancel</Button>
              <Button onClick={saveSale} disabled={saving || saleItems.length === 0 || saleItemTotal <= 0}>
                {saving ? "Saving..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                {selectedSale
                  ? `Invoice ${selectedSale.invoice_number} — balance: ${money(
                      Number(selectedSale.total_amount) -
                        Number(selectedSale.amount_paid),
                    )}`
                  : "Enter a payment amount."}
              </DialogDescription>
            </DialogHeader>
            <FormField label="Amount received (₦)">
              <Input
                type="number"
                min="1"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount received"
              />
            </FormField>
            <p className="text-xs text-muted-foreground">
              This updates the invoice's cumulative amount paid. The current
              database does not store separate payment-history entries.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPaymentDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={savePayment} disabled={saving}>
                {saving ? "Saving..." : "Save Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={receiptDialog} onOpenChange={setReceiptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sales Receipt</DialogTitle>
              <DialogDescription>
                Receipt summary for the selected sale.
              </DialogDescription>
            </DialogHeader>
            {selectedSale && (
              <div id="sales-receipt" className="space-y-3 rounded-lg border p-5">
                <div className="text-center">
                  <h2 className="text-xl font-bold">
                    TOBADDY AGRO LIVESTOCK
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Sales Receipt
                  </p>
                </div>
                <div className="border-t" />
                <ReceiptLine
                  label="Invoice"
                  value={selectedSale.invoice_number}
                />
                <ReceiptLine
                  label="Date"
                  value={selectedSale.sale_date}
                />
                <ReceiptLine
                  label="Customer"
                  value={
                    customerNames.get(selectedSale.customer_id ?? "") ||
                    "Walk-in customer"
                  }
                />
                <div className="border-t" />
                <ReceiptLine
                  label="Sale total"
                  value={money(Number(selectedSale.total_amount))}
                />
                <ReceiptLine
                  label="Total paid"
                  value={money(Number(selectedSale.amount_paid))}
                />
                <ReceiptLine
                  label="Balance"
                  value={money(
                    Math.max(
                      0,
                      Number(selectedSale.total_amount) -
                        Number(selectedSale.amount_paid),
                    ),
                  )}
                />
                <ReceiptLine
                  label="Payment status"
                  value={selectedSale.payment_status}
                />
                {selectedSale.notes && (
                  <p className="text-sm">Notes: {selectedSale.notes}</p>
                )}
                <p className="pt-3 text-center text-xs text-muted-foreground">
                  Thank you for your business.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReceiptDialog(false)}
              >
                Close
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RequirePermission>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-xl font-bold">{value}</p>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize">{value}</span>
    </div>
  );
}

function EmptyRow({
  message,
  columns,
}: {
  message: string;
  columns: number;
}) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="p-8 text-center text-muted-foreground"
      >
        {message}
      </td>
    </tr>
  );
}

function SalesTable({
  sales,
  customerNames,
  onPayment,
  onReceipt,
  canManage,
  paymentsOnly = false,
  receiptsOnly = false,
}: {
  sales: Sale[];
  customerNames: Map<string, string>;
  onPayment: (sale: Sale) => void;
  onReceipt: (sale: Sale) => void;
  canManage: boolean;
  paymentsOnly?: boolean;
  receiptsOnly?: boolean;
}) {
  const rows = paymentsOnly
    ? sales.filter((sale) => Number(sale.amount_paid) > 0)
    : receiptsOnly
      ? sales.filter((sale) => Number(sale.amount_paid) > 0)
      : sales;

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 font-medium">Invoice</th>
            <th className="p-3 font-medium">Customer</th>
            <th className="p-3 font-medium">Date</th>
            <th className="p-3 font-medium">Total</th>
            <th className="p-3 font-medium">Paid</th>
            <th className="p-3 font-medium">Balance</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sale) => {
            const total = Number(sale.total_amount) || 0;
            const paid = Number(sale.amount_paid) || 0;
            const balance = Math.max(0, total - paid);

            return (
              <tr key={sale.id} className="border-t">
                <td className="p-3 font-medium">{sale.invoice_number}</td>
                <td className="p-3">
                  {customerNames.get(sale.customer_id ?? "") ||
                    "Walk-in customer"}
                </td>
                <td className="p-3">{sale.sale_date}</td>
                <td className="p-3">{money(total)}</td>
                <td className="p-3">{money(paid)}</td>
                <td className="p-3">{money(balance)}</td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      sale.payment_status === "paid"
                        ? "bg-green-100 text-green-800"
                        : sale.payment_status === "partial"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {sale.payment_status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {!receiptsOnly && canManage && balance > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPayment(sale)}
                      >
                        Record payment
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReceipt(sale)}
                    >
                      <Receipt className="mr-1 h-4 w-4" />
                      Receipt
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <EmptyRow
              message={
                receiptsOnly
                  ? "No paid invoices available for receipts yet."
                  : paymentsOnly
                    ? "No payments recorded yet."
                    : "No invoices found. Create your first invoice to get started."
              }
              columns={8}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function SalesPage() {
  return <SalesContent />;
}

