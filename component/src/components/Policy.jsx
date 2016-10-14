import React, { Component } from 'react'
import { Field, reduxForm } from 'redux-form';

const PolicyForm = ({ onSubmit, handleSubmit }) => (
  <div>
    <form onSubmit={handleSubmit(onSubmit)}>
      <Field name="name" component="input" type="text" placeholder="Policy Name"/>
      <button type="submit">Save</button>
    </form>
  </div>
)

export default reduxForm({
  form: 'policy'
})(PolicyForm)
