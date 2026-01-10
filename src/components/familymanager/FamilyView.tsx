'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Checkbox } from "@/src/components/ui/checkbox";
import { 
  Edit, 
  Users, 
  LogIn, 
  Check, 
  X, 
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ShareButton } from '@/src/components/ui/share-button';
import { useLocalization } from '@/src/context/localization';

// Types for our family data
interface FamilyData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  caretakerCount?: number;
  babyCount?: number;
}

interface FamilyViewProps {
  families: FamilyData[];
  paginatedData: FamilyData[];
  onEdit: (family: FamilyData) => void;
  onViewCaretakers: (family: FamilyData) => void;
  onLogin: (family: FamilyData) => void;
  onSave: (family: FamilyData) => void;
  onCancelEdit: () => void;
  editingId: string | null;
  editingData: Partial<FamilyData>;
  setEditingData: React.Dispatch<React.SetStateAction<Partial<FamilyData>>>;
  saving: boolean;
  slugError: string;
  checkingSlug: boolean;
  appConfig: { rootDomain: string; enableHttps: boolean } | null;
  formatDateTime: (dateString: string | null) => string;
}

export default function FamilyView({
  families,
  paginatedData,
  onEdit,
  onViewCaretakers,
  onLogin,
  onSave,
  onCancelEdit,
  editingId,
  editingData,
  setEditingData,
  saving,
  slugError,
  checkingSlug,
  appConfig,
  formatDateTime,
}: FamilyViewProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('Family Name')}</TableHead>
          <TableHead>Link/Slug</TableHead>
          <TableHead>{t('Created')}</TableHead>
          <TableHead>{t('Updated')}</TableHead>
          <TableHead>{t('Status')}</TableHead>
          <TableHead>{t('Members')}</TableHead>
          <TableHead>{t('Babies')}</TableHead>
          <TableHead className="text-right">{t('Actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-gray-500">
              {t('No families found.')}
            </TableCell>
          </TableRow>
        ) : (
          paginatedData.map((family) => {
            const isEditing = editingId === family.id;
            
            return (
              <TableRow key={family.id}>
                <TableCell className="font-medium">
                  {isEditing ? (
                    <Input
                      value={editingData.name || ''}
                      onChange={(e) => setEditingData(prev => ({ ...prev, name: e.target.value }))}
                      className="min-w-[200px]"
                    />
                  ) : (
                    family.name
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {isEditing ? (
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          value={editingData.slug || ''}
                          onChange={(e) => setEditingData(prev => ({ ...prev, slug: e.target.value }))}
                          className={`min-w-[150px] ${slugError ? 'border-red-500' : ''}`}
                        />
                        {checkingSlug && (
                          <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                        )}
                      </div>
                      {slugError && (
                        <div className="flex items-center gap-1 text-red-600 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          {slugError}
                        </div>
                      )}
                    </div>
                  ) : (
                    family.slug
                  )}
                </TableCell>
                <TableCell className="text-sm">{formatDateTime(family.createdAt)}</TableCell>
                <TableCell className="text-sm">{formatDateTime(family.updatedAt)}</TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={editingData.isActive !== undefined ? editingData.isActive : family.isActive}
                        onCheckedChange={(checked) => setEditingData(prev => ({ ...prev, isActive: !!checked }))}
                      />
                      <label className="text-sm">{t('Active')}</label>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        family.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {family.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </TableCell>
                <TableCell>{family.caretakerCount || 0}</TableCell>
                <TableCell>{family.babyCount || 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSave(family)}
                          disabled={saving || !!slugError || checkingSlug}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onCancelEdit}
                          disabled={saving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(family)}
                          title="Edit family"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewCaretakers(family)}
                          title="View caretakers"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <ShareButton
                          familySlug={family.slug}
                          familyName={family.name}
                          appConfig={appConfig || undefined}
                          variant="outline"
                          size="sm"
                          showText={false}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onLogin(family)}
                          title="Login to family"
                        >
                          <LogIn className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
