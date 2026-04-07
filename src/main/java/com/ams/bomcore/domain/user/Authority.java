package com.ams.bomcore.domain.user;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.util.Assert;



@Entity
@Table(name = "authorities")
@Access(value=AccessType.FIELD)
public class Authority implements GrantedAuthority {

	/**
	 *
	 */
	private static final long serialVersionUID = -8380164179223218467L;


	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private int	id	= 0 ;
	@Column(name = "username")
	private String	username	;
	@Column(name = "authority")
	private String authority;
	@Column(name = "description")
	
	@Transient
	private String authName = "";
	
	private String description;
	@Column(name = "visible")
	private Boolean visible = Boolean.TRUE;


	/**
	 * @return the id
	 */
	
	public Authority() {
	
	}

	public int getId() {
		return id;
	}

	/**
	 * @param id the id to set
	 */
	public void setId(int id) {
		this.id = id;
	}

	/**
	 * @return the description
	 */
	public String getDescription() {
		return description;
	}

	/**
	 * @param description the description to set
	 */
	public void setDescription(String description) {
		this.description = description;
	}

	public Authority(String role) {
		Assert.hasText(role, "A granted authority textual representation is required");
		this.authority = role;
	}

	public Authority(int idString, String usernameString, String authString, String desString) {
		// TODO Auto-generated constructor stub
		this.id = idString;
		setUsername(usernameString);
		setAuthority(authString);
		setDescription(desString);
	}

	@Override
	public String getAuthority() {
		return this.authority;
	}

	public void  setAuthority(String ath) {
		 this.authority = ath;
	}

	/**
	 * @return the username
	 */
	public String getUsername() {
		return username==null?"":username;
	}

	/**
	 * @param username the username to set
	 */
	public void setUsername(String username) {
		this.username = username;
	}

	public Boolean getVisible() {
		return visible;
	}

	public void setVisible(Boolean visible) {
		this.visible = visible;
	}

	public String getAuthName() {
		return authName;
	}

	public void setAuthName(String authName) {
		this.authName = authName;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj) {
			return true;
		}
		if (obj instanceof Authority) {
			String otherAuthority = ((Authority) obj).authority;
			if (this.authority == null) {
				return otherAuthority == null;
			}
			return this.authority.equals(otherAuthority);
		}
		return false;
	}

	@Override
	public int hashCode() {
		return this.authority == null ? 0 : this.authority.hashCode();
	}

	@Override
	public String toString() {
		return this.authority;
	}
	
	public Authority deepCopy() {
	    Authority copy = new Authority();

	    // Generally, you may not want to copy the ID if the copy will be persisted as a new entity.
	    // Uncomment below if necessary
	    // copy.id = this.id;

	    copy.username = this.username;
	    copy.authority = this.authority;
	    copy.description = this.description;

	    return copy;
	}



}
