import { Document } from 'mongoose'

import { IFormSchema } from '../form'
import { BasicFieldType, MyInfoAttribute } from './fieldTypes'

export interface IMyInfo {
  attr: MyInfoAttribute
}

export interface IMyInfoSchema extends IMyInfo, Document {
  /** Returns the top level document of this sub-document. */
  ownerDocument(): IFormSchema
  /** Returns this sub-documents parent document. */
  parent(): IFieldSchema
}

export interface IField {
  globalId: string
  title: string
  description: string
  required: boolean
  disabled: boolean
  fieldType: BasicFieldType
  myInfo?: IMyInfo
  _id: Document['_id']
}

// Manual override since mongoose types don't have generics yet.
export interface IFieldSchema extends IField, Document {
  /** Returns the top level document of this sub-document. */
  ownerDocument(): IFormSchema
  /** Returns this sub-documents parent document. */
  parent(): IFormSchema
}

// We don't store a fieldValue in the database, but the client
// needs it as a variable to store the client's answer to a field.
// Hence we need this interface for client-side fields.
export interface IClientFieldSchema extends IFieldSchema {
  fieldValue: string
}
