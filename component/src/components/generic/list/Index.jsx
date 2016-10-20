import React, { Component } from 'react'

import Item from './Item'
import Filter from './Filter'

export default class List extends Component {
  constructor (props) {
    super(props)

    this.state = {
      selected: null,
      filtered: props.items
    }

    this.itemSelected = ::this.itemSelected
    this.filterChanged = ::this.filterChanged
  }

  itemSelected (selected) {
    this.setState({ selected })
    this.props.onItemSelect(selected)
  }

  filterChanged (filter) {
    filter = filter.toLowerCase()
    const filtered = this.props.items.filter(item => ~item.name.toLowerCase().indexOf(filter))

    this.setState({ filtered })
  }

  render () {
    const { filtered, selected } = this.state

    const listItems = filtered.map(item => {
      return (
        <Item
          key={item.id}
          item={item}
          selected={item === selected}
          onItemSelect={this.itemSelected}
        />
      )
    })

    return (
      <div>
        <Filter onFilterChange={this.filterChanged} which={this.props.which} />
        <ul className='filterlist--list-items'>
          <li className='filterlist--item'>
            <i className='fa fa-plus'></i>
            <span className='filterlist--add-item'>Add {this.props.which}</span>
          </li>
          {listItems}
        </ul>
      </div>
    )
  }
}

List.propTypes = {
  which: React.PropTypes.string.isRequired,
  items: React.PropTypes.array.isRequired,
  selected: React.PropTypes.object,
  onItemSelect: React.PropTypes.func.isRequired
}
