'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type EmployeeAccess = {
  id: string
  email: string
  status: string
  notes?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  addedBy: {
    name: string
    email: string
  }
}

export default function EmployeeAccessPage() {
  const [entries, setEntries] = useState<EmployeeAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchEntries = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/employee-access')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch entries: ${response.status}`)
      }
      const data = await response.json()
      setEntries(data)
    } catch (error) {
      console.error('Error fetching employee access list:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch employee access list')
      toast({
        title: 'Error',
        description: 'Failed to fetch employee access list. Please try refreshing the page.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  const handleAdd = async () => {
    try {
      const response = await fetch('/api/admin/employee-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, notes })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setEntries([data, ...entries])
      setIsAddDialogOpen(false)
      setEmail('')
      setNotes('')
      toast({
        title: 'Success',
        description: 'Employee access added successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add employee access',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return

    try {
      const response = await fetch(`/api/admin/employee-access?id=${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete entry')

      setEntries(entries.filter(entry => entry.id !== id))
      toast({
        title: 'Success',
        description: 'Employee access deleted successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete employee access',
        variant: 'destructive'
      })
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/admin/employee-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setEntries(entries.map(entry => 
        entry.id === id ? { ...entry, status: newStatus } : entry
      ))
      toast({
        title: 'Success',
        description: 'Status updated successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      APPROVED: 'bg-green-500',
      PENDING: 'bg-yellow-500',
      REVOKED: 'bg-red-500'
    }
    return <Badge className={variants[status] || 'bg-gray-500'}>{status}</Badge>
  }

  if (error) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Employee Access</h2>
            <p className="text-muted-foreground">
              Manage employee access to the system
            </p>
          </div>
        </div>
        
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="rounded-full bg-red-100 p-3 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Error Loading Employee Access</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchEntries}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Employee Access</h2>
          <p className="text-muted-foreground">
            Manage employee access to the system
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Employee Access</DialogTitle>
              <DialogDescription>
                Add a new employee to the access list
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="employee@company.com"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes about this employee"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Added On</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>
                    <select
                      value={entry.status}
                      onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                      className="bg-transparent border rounded px-2 py-1"
                      aria-label="Status"
                    >
                      <option value="APPROVED">Approved</option>
                      <option value="PENDING">Pending</option>
                      <option value="REVOKED">Revoked</option>
                    </select>
                  </TableCell>
                  <TableCell>{entry.addedBy.name}</TableCell>
                  <TableCell>{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.notes || '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 